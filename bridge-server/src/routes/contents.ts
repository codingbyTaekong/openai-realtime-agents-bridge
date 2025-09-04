import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import type { ContentType } from '@prisma/client';
import prisma from '../lib/prisma';

const router = Router();

// 업로드 저장소 설정
const uploadsDir = path.resolve(process.cwd(), 'upload_files');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname);
        const base = path.basename(file.originalname, ext);
        const safeBase = base.replace(/[^a-zA-Z0-9-_]/g, '_');
        const filename = `${safeBase}-${uuidv4()}${ext}`;
        cb(null, filename);
    }
});

const upload = multer({ storage });

// 컨텐츠 목록 조회
router.get('/', async (req, res) => {
    try {
        //pagenation
        const page = req.query.page ? parseInt(req.query.page as string) : 1;
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
        const orderBy = req.query.orderBy ? req.query.orderBy as string : 'createdAt';
        const order = req.query.order ? req.query.order as string : 'desc';
        const skip = (page - 1) * limit;
        const total = await prisma.contents.count();
        const contents = await prisma.contents.findMany({
            skip,
            take: limit,
            orderBy: {
                [orderBy]: order
            }
        });
        const pagenation = {
            totalCount: total,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            hasNextPage: page < Math.ceil(total / limit),
            hasPreviousPage: page > 1,
            pageSize: limit,
        };
        res.json({
            pagenation,
            contents
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch contents' });
    }
});

// 컨텐츠 업로드
router.post('/', upload.single('file'), async (req, res) => {
    try {
        const { name, type, duration, sceneId } = req.body as { name?: string; type?: string; duration?: string; sceneId?: string };

        if (!name || !type) {
            return res.status(400).json({ error: 'name과 type은 필수입니다.' });
        }

        const normalizedType = type.toUpperCase();
        const allowedTypes: ContentType[] = ['IMAGE', 'VIDEO', 'SCENE'] as unknown as ContentType[];
        if (!allowedTypes.includes(normalizedType as unknown as ContentType)) {
            return res.status(400).json({ error: 'type은 IMAGE, VIDEO, SCENE 중 하나여야 합니다.' });
        }

        // 파일 필수 조건: IMAGE 또는 VIDEO일 때 파일 필요
        const requiresFile = normalizedType === 'IMAGE' || normalizedType === 'VIDEO';
        if (requiresFile && !req.file) {
            return res.status(400).json({ error: '해당 type에서는 파일 업로드가 필수입니다.' });
        }

        let originFileName: string | undefined;
        let filePath: string | undefined;
        if (req.file) {
            originFileName = req.file.originalname;
            filePath = `/uploads/${req.file.filename}`;
        }

        const created = await prisma.contents.create({
            data: {
                name,
                type: normalizedType as unknown as ContentType,
                originFileName: originFileName || null,
                filePath: filePath || null,
                duration: duration ? parseInt(duration) : null,
                sceneId: sceneId || null
            }
        });

        res.status(201).json(created);
    } catch (error) {
        console.error('컨텐츠 업로드 실패:', error);
        res.status(500).json({ error: '컨텐츠 업로드에 실패했습니다.' });
    }
});

let previousContentId: string | null = null;

router.get("/random", async (req, res) => {
    try {
        const whereClause: any = { useAt: true };
        if (previousContentId) {
            whereClause.contentId = { not: previousContentId };
        }

        const total = await prisma.contents.count({ where: whereClause });
        if (total === 0) {
            return res.status(404).json({ error: '선택 가능한 컨텐츠가 없습니다.' });
        }

        const randomSkip = Math.floor(Math.random() * total);
        const [randomContent] = await prisma.contents.findMany({
            where: whereClause,
            skip: randomSkip,
            take: 1
        });

        previousContentId = randomContent.contentId;
        res.json(randomContent);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch random contents' });
    }
});

export default router;
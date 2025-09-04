"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const uuid_1 = require("uuid");
const prisma_1 = __importDefault(require("../lib/prisma"));
const router = (0, express_1.Router)();
// 업로드 저장소 설정
const uploadsDir = path_1.default.resolve(process.cwd(), 'upload_files');
if (!fs_1.default.existsSync(uploadsDir)) {
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
}
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (_req, file, cb) => {
        const ext = path_1.default.extname(file.originalname);
        const base = path_1.default.basename(file.originalname, ext);
        const safeBase = base.replace(/[^a-zA-Z0-9-_]/g, '_');
        const filename = `${safeBase}-${(0, uuid_1.v4)()}${ext}`;
        cb(null, filename);
    }
});
const upload = (0, multer_1.default)({ storage });
router.get('/', async (req, res) => {
    try {
        const contents = await prisma_1.default.contents.findMany();
        res.json(contents);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch contents' });
    }
});
// 컨텐츠 업로드
router.post('/', upload.single('file'), async (req, res) => {
    try {
        const { name, type } = req.body;
        if (!name || !type) {
            return res.status(400).json({ error: 'name과 type은 필수입니다.' });
        }
        const normalizedType = type.toUpperCase();
        const allowedTypes = ['IMAGE', 'VIDEO', 'SCENE'];
        if (!allowedTypes.includes(normalizedType)) {
            return res.status(400).json({ error: 'type은 IMAGE, VIDEO, SCENE 중 하나여야 합니다.' });
        }
        // 파일 필수 조건: IMAGE 또는 VIDEO일 때 파일 필요
        const requiresFile = normalizedType === 'IMAGE' || normalizedType === 'VIDEO';
        if (requiresFile && !req.file) {
            return res.status(400).json({ error: '해당 type에서는 파일 업로드가 필수입니다.' });
        }
        let originFileName;
        let filePath;
        if (req.file) {
            originFileName = req.file.originalname;
            filePath = `/uploads/${req.file.filename}`;
        }
        const created = await prisma_1.default.contents.create({
            data: {
                name,
                type: normalizedType,
                originFileName: originFileName || null,
                filePath: filePath || null
            }
        });
        res.status(201).json(created);
    }
    catch (error) {
        console.error('컨텐츠 업로드 실패:', error);
        res.status(500).json({ error: '컨텐츠 업로드에 실패했습니다.' });
    }
});
exports.default = router;
//# sourceMappingURL=contents.js.map
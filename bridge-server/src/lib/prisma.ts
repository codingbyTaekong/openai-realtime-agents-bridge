import { PrismaClient } from '@prisma/client';

// Prisma 클라이언트 인스턴스 생성
const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// 데이터베이스 연결 확인
prisma.$connect()
    .then(() => {
        console.log('✅ Database connected successfully');
    })
    .catch((error: Error) => {
        console.error('❌ Database connection failed:', error);
    });

// Graceful shutdown
process.on('beforeExit', async () => {
    await prisma.$disconnect();
});

export default prisma; 
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
// Prisma 클라이언트 인스턴스 생성
const prisma = new client_1.PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});
// 데이터베이스 연결 확인
prisma.$connect()
    .then(() => {
    console.log('✅ Database connected successfully');
})
    .catch((error) => {
    console.error('❌ Database connection failed:', error);
});
// Graceful shutdown
process.on('beforeExit', async () => {
    await prisma.$disconnect();
});
exports.default = prisma;
//# sourceMappingURL=prisma.js.map
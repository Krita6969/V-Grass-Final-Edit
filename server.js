const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();
const JWT_SECRET = 'SakonNakhonDataCenter_SecureKey_2026';

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'โปรดเข้าสู่ระบบก่อนใช้งาน' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'Token ไม่ถูกต้องหรือหมดอายุ' });
        req.user = user;
        next();
    });
};

// --- AUTH API ---
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { username } });
        if (!user) return res.status(400).json({ message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(400).json({ message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });

        const token = jwt.sign(
            { userId: user.id, username: user.username, role: user.role, fullName: user.fullName },
            JWT_SECRET,
            { expiresIn: '12h' }
        );

        res.json({ token, user: { username: user.username, role: user.role, fullName: user.fullName } });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
    
});

// --- REGISTER API ---
app.post('/api/register', async (req, res) => {
    const { username, password, fullName, role } = req.body;
    try {
        // เช็คว่ามีอีเมลนี้ในระบบหรือยัง
        const existingUser = await prisma.user.findUnique({ where: { username } });
        if (existingUser) {
            return res.status(400).json({ message: 'อีเมลนี้ถูกใช้งาน, กรุณาใช้อีเมลอื่น' });
        }

        // เข้ารหัสผ่านก่อนบันทึกลง Database
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: { 
                username, 
                password: hashedPassword, 
                fullName: fullName || 'ผู้ใช้งานระบบ', 
                role: role || 'FARMER' 
            }
        });

        res.status(201).json({ message: 'สมัครสมาชิกสำเร็จ', user: { username: user.username, fullName: user.fullName } });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// --- DASHBOARD API ---
app.get('/api/dashboard', authenticateToken, async (req, res) => {
    try {
        const totalFarmers = await prisma.farmer.count();
        const lands = await prisma.land.aggregate({ _sum: { areaRai: true } });
        const plans = await prisma.productionPlan.findMany({
            include: { crop: true, farmer: true, land: true, costBreakdown: true }
        });

        let totalPlannedCost = 0, totalExpectedYield = 0, totalExpectedRevenue = 0;

        plans.forEach(p => {
            const costPerRai = p.costBreakdown 
                ? (p.costBreakdown.costSeed + p.costBreakdown.costFertilizer + p.costBreakdown.costLabor + p.costBreakdown.costWaterElec + p.costBreakdown.costOther)
                : (p.crop ? p.crop.costPerRai : 0);

            const planTotalCost = (costPerRai * p.areaUsedRai) * p.rounds;
            const rawYield = p.crop ? ((p.crop.yieldPerRai * p.areaUsedRai) * p.rounds) : 0;
            const sellablePct = p.costBreakdown ? p.costBreakdown.sellablePct : 90.0;
            const sellableYield = Math.round(rawYield * (sellablePct / 100));
            const expectedRevenue = p.crop ? (sellableYield * p.crop.pricePerKg) : 0;

            totalPlannedCost += planTotalCost;
            totalExpectedYield += sellableYield;
            totalExpectedRevenue += expectedRevenue;
        });

        res.json({
            kpi: {
                totalFarmers,
                totalAreaRai: lands._sum.areaRai || 0,
                totalPlans: plans.length,
                totalPlannedCost,
                totalExpectedYield,
                totalExpectedRevenue
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// --- FARMERS CRUD ---
app.get('/api/farmers', authenticateToken, async (req, res) => {
    const farmers = await prisma.farmer.findMany({ include: { lands: true } });
    res.json(farmers);
});

app.post('/api/farmers', authenticateToken, async (req, res) => {
    const { name, phone, address } = req.body;
    try {
        const count = await prisma.farmer.count();
        const code = 'F' + String(count + 1).padStart(3, '0');
        const farmer = await prisma.farmer.create({ data: { code, name, phone, address } });
        res.status(201).json(farmer);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

app.delete('/api/farmers/:id', authenticateToken, async (req, res) => {
    try {
        await prisma.farmer.delete({ where: { id: req.params.id } });
        res.json({ message: 'ลบสำเร็จ' });
    } catch (error) {
        res.status(400).json({ message: 'ไม่สามารถลบข้อมูลเนื่องจากมีการเชื่อมโยงตารางอื่นอยู่' });
    }
});

// --- LANDS CRUD ---
app.get('/api/lands', authenticateToken, async (req, res) => {
    const lands = await prisma.land.findMany({ include: { farmer: true } });
    res.json(lands);
});

app.post('/api/lands', authenticateToken, async (req, res) => {
    const { name, farmerId, areaRai, soilType, soilPh, waterSystem } = req.body;
    try {
        const count = await prisma.land.count();
        const code = 'L' + String(count + 1).padStart(3, '0');
        const land = await prisma.land.create({
            data: { code, name, farmerId, areaRai: parseFloat(areaRai), soilType, soilPh: parseFloat(soilPh), waterSystem }
        });
        res.status(201).json(land);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

app.delete('/api/lands/:id', authenticateToken, async (req, res) => {
    try {
        await prisma.land.delete({ where: { id: req.params.id } });
        res.json({ message: 'ลบสำเร็จ' });
    } catch (error) {
        res.status(400).json({ message: 'ไม่สามารถลบแปลงได้' });
    }
});

// --- CROPS CRUD (พร้อมฟิลด์ ระยะทำการปลูก spacingMeter) ---
app.get('/api/crops', authenticateToken, async (req, res) => {
    const crops = await prisma.crop.findMany();
    res.json(crops);
});

app.post('/api/crops', authenticateToken, async (req, res) => {
    const { name, durationDays, yieldPerRai, costPerRai, pricePerKg, careLevel, spacingMeter } = req.body;
    try {
        const count = await prisma.crop.count();
        const code = 'C' + String(count + 1).padStart(3, '0');
        const crop = await prisma.crop.create({
            data: {
                code,
                name,
                durationDays: parseInt(durationDays),
                yieldPerRai: parseFloat(yieldPerRai),
                costPerRai: parseFloat(costPerRai),
                pricePerKg: parseFloat(pricePerKg),
                careLevel: careLevel || 'ปานกลาง',
                spacingMeter: spacingMeter || '0.5 x 0.5',
                isSampleData: false
            }
        });
        res.status(201).json(crop);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

app.delete('/api/crops/:id', authenticateToken, async (req, res) => {
    try {
        await prisma.crop.delete({ where: { id: req.params.id } });
        res.json({ message: 'ลบพืชสำเร็จ' });
    } catch (error) {
        res.status(400).json({ message: 'ไม่สามารถลบข้อมูลเนื่องจากมีการเชื่อมโยงตารางอื่นอยู่' });
    }
});

// --- MARKETS CRUD (จัดการข้อมูลตลาดและผู้รับซื้อ) ---
// --- ตรวจสอบ API Markets ใน server.js ---
app.get('/api/markets', authenticateToken, async (req, res) => {
    try {
        const markets = await prisma.market.findMany();
        res.json(markets);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post('/api/markets', authenticateToken, async (req, res) => {
    const { buyerName, targetCrop, quantityKg, buyingPrice, demandStatus, contactPhone } = req.body;
    try {
        const market = await prisma.market.create({
            data: {
                buyerName,
                targetCrop,
                quantityKg: parseFloat(quantityKg),
                buyingPrice: parseFloat(buyingPrice),
                demandStatus,
                contactPhone
            }
        });
        res.status(201).json(market);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// --- PLANS API ---
app.get('/api/plans', authenticateToken, async (req, res) => {
    const plans = await prisma.productionPlan.findMany({
        include: { farmer: true, land: true, crop: true, costBreakdown: true }
    });
    res.json(plans);
});

app.post('/api/plans', authenticateToken, async (req, res) => {
    const { farmerId, landId, cropId, cropDetails, areaUsedRai, subPlots, startDate, rounds } = req.body;
    try {
        const areaReq = parseFloat(areaUsedRai);
        const land = await prisma.land.findUnique({
            where: { id: landId },
            include: { plans: { where: { status: 'กำลังดำเนินการ' } } }
        });

        if (!land) return res.status(404).json({ message: 'ไม่พบแปลงเพาะปลูก' });

        const count = await prisma.productionPlan.count();
        const code = 'P' + String(count + 1).padStart(3, '0');

        let defaultCost = 20000;
        if (cropId) {
            const crop = await prisma.crop.findUnique({ where: { id: cropId } });
            if (crop) defaultCost = crop.costPerRai;
        }

        const newPlan = await prisma.productionPlan.create({
            data: {
                code, farmerId, landId, cropId: cropId || null,
                cropDetails: cropDetails ? JSON.stringify(cropDetails) : null,
                areaUsedRai: areaReq,
                subPlots: parseInt(subPlots || 1),
                startDate: new Date(startDate),
                rounds: parseInt(rounds || 1),
                costBreakdown: {
                    create: {
                        costSeed: defaultCost * 0.25,
                        costFertilizer: defaultCost * 0.35,
                        costLabor: defaultCost * 0.20,
                        costWaterElec: defaultCost * 0.10,
                        costOther: defaultCost * 0.10,
                        sellablePct: 90.0
                    }
                }
            }
        });

        res.status(201).json(newPlan);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// --- USERS MANAGEMENT API ---
app.get('/api/users', authenticateToken, async (req, res) => {
    const users = await prisma.user.findMany({
        select: { id: true, username: true, fullName: true, role: true, createdAt: true }
    });
    res.json(users);
});

app.post('/api/users', authenticateToken, async (req, res) => {
    const { username, password, fullName, role } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: { username, password: hashedPassword, fullName, role }
        });
        res.status(201).json(user);
    } catch (error) {
        res.status(400).json({ message: 'ชื่อผู้ใช้งานนี้มีในระบบแล้ว' });
    }
});

app.delete('/api/users/:id', authenticateToken, async (req, res) => {
    try {
        await prisma.user.delete({ where: { id: req.params.id } });
        res.json({ message: 'ลบผู้ใช้สำเร็จ' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server running on port ${PORT}`));
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 กำลังล้างข้อมูลเก่าและนำเข้าข้อมูลครบถ้วนทุก Model ตาม Schema...');

  // 1. เคลียร์ข้อมูลเก่าตามลำดับความสัมพันธ์ (Foreign Key)
  await prisma.costBreakdown.deleteMany();
  await prisma.productionPlan.deleteMany();
  await prisma.market.deleteMany();
  await prisma.crop.deleteMany();
  await prisma.land.deleteMany();
  await prisma.farmer.deleteMany();
  await prisma.user.deleteMany();

  // 2. เติมข้อมูลผู้ใช้ระบบ (User / RBAC) พร้อมเข้ารหัสผ่าน (Bcrypt)
  const hashedAdminPassword = await bcrypt.hash('123456', 10);
  const hashedAgentPassword = await bcrypt.hash('123456', 10);

  await prisma.user.createMany({
    data: [
      {
        username: 'admin@vgrass.com',
        password: hashedAdminPassword,
        fullName: 'นายสมชาย ใจดี',
        role: 'ADMIN'
      },
      {
        username: 'agent1@vgrass.com',
        password: hashedAgentPassword,
        fullName: 'นางสาววิไล สวยงาม',
        role: 'AGENT'
      }
    ]
  });

  // 3. เติมข้อมูลเกษตรกร (Farmer)
  const farmer1 = await prisma.farmer.create({
    data: {
      code: 'P-4701',
      name: 'นายสมศักดิ์ มีสุข',
      phone: '081-234-5678',
      address: 'อ.เมืองสกลนคร (ต.ธาตุเชิงชุม) 123/4 หมู่ 2'
    }
  });

  const farmer2 = await prisma.farmer.create({
    data: {
      code: 'P-4702',
      name: 'นางวันดี ขยันยิ่ง',
      phone: '089-876-5432',
      address: 'อ.สว่างแดนดิน (ต.บงเหนือ) 45 หมู่ 1 ถ.นิตโย'
    }
  });

  const farmer3 = await prisma.farmer.create({
    data: {
      code: 'P-4703',
      name: 'นายบุญมี รุ่งเรือง',
      phone: '086-112-3344',
      address: 'อ.วานรนิวาส (ต.เดื่อศรีไพร) 88/2 หมู่ 6'
    }
  });

  const farmer4 = await prisma.farmer.create({
    data: {
      code: 'P-4704',
      name: 'นางพิมพา ภูพานทอง',
      phone: '093-554-1122',
      address: 'อ.ภูพาน (ต.โคกภู) 12 หมู่ 3'
    }
  });

  // 4. เติมข้อมูลแปลงเพาะปลูก (Land)
  const field1 = await prisma.land.create({
    data: {
      code: 'L-001',
      name: 'แปลงสระบัว A1 (แปลงคราม)',
      areaRai: 2.5,
      soilType: 'ดินร่วนปนทราย',
      soilPh: 6.5,
      waterSystem: 'สปริงเกอร์',
      farmerId: farmer1.id
    }
  });

  await prisma.land.create({
    data: {
      code: 'L-002',
      name: 'แปลงดอนขาม B2 (ผักสวนครัว)',
      areaRai: 1.5,
      soilType: 'ดินร่วน',
      soilPh: 6.8,
      waterSystem: 'น้ำหยด',
      farmerId: farmer2.id
    }
  });

  await prisma.land.create({
    data: {
      code: 'L-003',
      name: 'แปลงหนองหาน C1 (แปลงข้าวฮาง)',
      areaRai: 4.0,
      soilType: 'ดินเหนียวปนร่วน',
      soilPh: 6.2,
      waterSystem: 'สปริงเกอร์',
      farmerId: farmer3.id
    }
  });

  await prisma.land.create({
    data: {
      code: 'L-004',
      name: 'แปลงเทือกเขาภูพาน (แปลงหมากเม่า GI)',
      areaRai: 3.5,
      soilType: 'ดินร่วนปนทราย',
      soilPh: 6.0,
      waterSystem: 'สปริงเกอร์',
      farmerId: farmer4.id
    }
  });

  // 5. เติมข้อมูลพืชเศรษฐกิจ & สินค้า GI (Crop)
  const crop1 = await prisma.crop.create({
    data: {
      code: 'C-001',
      name: 'ต้นคราม',
      durationDays: 100,
      yieldPerRai: 3000,
      costPerRai: 25000,
      pricePerKg: 50,
      careLevel: 'ปานกลาง',
      spacingMeter: '0.5 x 0.5',
      cyclesPerYear: 3,
      isSampleData: true
    }
  });

  await prisma.crop.createMany({
    data: [
      { code: 'C-002', name: 'หมากเม่า', durationDays: 120, yieldPerRai: 1500, costPerRai: 30000, pricePerKg: 80, careLevel: 'สูง', spacingMeter: '2.0 x 2.0', cyclesPerYear: 2, isSampleData: true },
      { code: 'C-003', name: 'ข้าวฮางหอมทอง', durationDays: 110, yieldPerRai: 600, costPerRai: 12000, pricePerKg: 65, careLevel: 'ปานกลาง', spacingMeter: '0.2 x 0.2', cyclesPerYear: 2, isSampleData: true },
      { code: 'C-004', name: 'กุยช่ายขาว', durationDays: 90, yieldPerRai: 2500, costPerRai: 38000, pricePerKg: 35, careLevel: 'สูง', spacingMeter: '0.3 x 0.3', cyclesPerYear: 4, isSampleData: true },
      { code: 'C-005', name: 'คะน้า', durationDays: 45, yieldPerRai: 2000, costPerRai: 15000, pricePerKg: 20, careLevel: 'ต่ำ', spacingMeter: '0.2 x 0.2', cyclesPerYear: 8, isSampleData: true }
    ]
  });

  // 6. เติมข้อมูลตลาดและผู้รับซื้อ (Market)
  await prisma.market.createMany({
    data: [
      { buyerName: 'กลุ่มวิสาหกิจผ้าย้อมครามสกลนคร', targetCrop: 'ใบครามสด / เนื้อคราม GI', quantityKg: 10000, buyingPrice: 50, demandStatus: 'ต้องการสูงมาก', contactPhone: '081-111-2222' },
      { buyerName: 'กลุ่มแปรรูปผลิตภัณฑ์หมากเม่าภูพาน', targetCrop: 'หมากเม่าผลสด (GI)', quantityKg: 5000, buyingPrice: 80, demandStatus: 'ปานกลาง', contactPhone: '082-333-4444' },
      { buyerName: 'ตลาดสดเทศบาลสกลนคร', targetCrop: 'กุยช่ายขาว / คะน้า / ผักบุ้ง', quantityKg: 2000, buyingPrice: 35, demandStatus: 'เพียงพอ', contactPhone: '083-555-6666' }
    ]
  });

  // 7. เติมข้อมูลแผนการผลิตเบื้องต้น (ProductionPlan & CostBreakdown)
  const plan1 = await prisma.productionPlan.create({
    data: {
      code: 'PL-001',
      farmerId: farmer1.id,
      landId: field1.id,
      cropId: crop1.id,
      areaUsedRai: 2.5,
      subPlots: 10,
      startDate: new Date('2026-05-01'),
      rounds: 2,
      status: 'กำลังดำเนินการ'
    }
  });

  await prisma.costBreakdown.create({
    data: {
      planId: plan1.id,
      costSeed: 6250,
      costFertilizer: 8750,
      costLabor: 5000,
      costWaterElec: 2500,
      costOther: 2500,
      sellablePct: 90.0
    }
  });

  console.log('🎉 สำเร็จ! นำเข้าข้อมูลตัวอย่างครบถ้วนทุก Model สมบูรณ์ 100% แล้วครับ');
}

main()
  .catch((e) => {
    console.error('❌ เกิดข้อผิดพลาดในการ Seed ข้อมูล:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
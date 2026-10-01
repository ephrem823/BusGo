import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Clean existing data in dependency order
  await prisma.booking.deleteMany();
  await prisma.seat.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.route.deleteMany();
  await prisma.bus.deleteMany();
  await prisma.user.deleteMany();

  // Buses
  const [bus1, bus2] = await Promise.all([
    prisma.bus.create({ data: { plateNumber: "AA-12345", operatorName: "Selam Bus", totalSeats: 45 } }),
    prisma.bus.create({ data: { plateNumber: "BB-67890", operatorName: "Sky Bus", totalSeats: 49 } }),
  ]);

  // Routes
  const [r1, r2, r3] = await Promise.all([
    prisma.route.create({ data: { origin: "Addis Ababa", destination: "Hawassa", distanceKm: 275 } }),
    prisma.route.create({ data: { origin: "Addis Ababa", destination: "Bahir Dar", distanceKm: 467 } }),
    prisma.route.create({ data: { origin: "Addis Ababa", destination: "Dire Dawa", distanceKm: 515 } }),
  ]);

  // Trips (next 3 days for each route)
  const today = new Date();
  const dates = [0, 1, 2].map((d) => {
    const dt = new Date(today);
    dt.setDate(today.getDate() + d);
    return dt.toISOString().split("T")[0];
  });

  const tripDefs = [
    { routeId: r1.id, busId: bus1.id, departureTime: "06:00", price: 250 },
    { routeId: r1.id, busId: bus2.id, departureTime: "14:00", price: 270 },
    { routeId: r2.id, busId: bus1.id, departureTime: "07:00", price: 380 },
    { routeId: r2.id, busId: bus2.id, departureTime: "20:00", price: 400 },
    { routeId: r3.id, busId: bus2.id, departureTime: "08:00", price: 420 },
  ];

  for (const date of dates) {
    for (const def of tripDefs) {
      const bus = def.busId === bus1.id ? bus1 : bus2;
      const trip = await prisma.trip.create({
        data: { ...def, date },
      });
      // Auto-generate seats for this trip
      await prisma.seat.createMany({
        data: Array.from({ length: bus.totalSeats }, (_, i) => ({
          tripId: trip.id,
          seatNumber: i + 1,
          status: "AVAILABLE",
        })),
      });
    }
  }

  console.log("✅ Seed complete — buses, routes, trips, and seats created.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

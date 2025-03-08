import { PrismaClient } from "@prisma/client";
import fs from "fs";

const prisma = new PrismaClient();

async function main() {
  const data = JSON.parse(fs.readFileSync("prisma/seed.json", "utf-8"));

  // Inserindo categorias
  const categoryMap = new Map();
  for (const category of data.categories) {
    let existingCategory = await prisma.category.findFirst({
      where: { title: category.title },
    });

    if (!existingCategory) {
      existingCategory = await prisma.category.create({
        data: { title: category.title },
      });
    }

    categoryMap.set(category.id, existingCategory.id);
  }

  // Inserindo transações associadas às categorias
  for (const transaction of data.transactions) {
    await prisma.transaction.create({
      data: {
        title: transaction.title,
        value: transaction.value,
        day: transaction.day ? new Date(transaction.day) : new Date(),
        type: transaction.type,
        user_id: transaction.userId,
        category_id: categoryMap.get(transaction.category) || null, // Associa à categoria
      },
    });
  }

  console.log("Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

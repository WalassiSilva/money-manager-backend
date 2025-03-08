import express from "express";
import { PrismaClient } from "@prisma/client";
import cors from "cors";
import { clerkMiddleware, requireAuth, getAuth } from "@clerk/express";

const app = express();
const port = 3333;
const prisma = new PrismaClient();

app.use(express.json());
app.use(cors());
// app.use(clerkMiddleware());

app.get("/", (req, res) => {
  res.send("Hello World!");
});

// --------------- GET TRANSACTIONS ----------------
app.get(
  "/api/transactions",
  //  requireAuth(),
  async (req, res) => {
    // const { auth } = req;

    // const { userId } = getAuth(req);
    // if (!userId) {
    //   return res.status(401).send({ message: "Nao autorizado" });
    // }

    try {
      const data = await prisma.transaction.findMany({
        // where: { user_id: userId },
        orderBy: [{ day: "desc" }, { id: "desc" }],
        include: {
          categories: {
            select: {
              title: true,
            },
          },
        },
      });
      res.json(data);
    } catch (error) {
      console.log("Error: ", error);
      return res.status(500).send({ message: "Erro ao buscar as transações" });
    }
  }
);

// --------------- GET CATEGORIES ----------------
app.get("/api/transactions/categories", async (req, res) => {
  try {
    const data = await prisma.category.findMany({
      orderBy: { id: "asc" },
    });
    res.json(data);
  } catch (error) {
    console.log("Error: ", error);
    return res.status(500).send({ message: "Erro ao buscar categorias" });
  }
});

// --------------- GET TRANSACTION BY ID -----------
app.get("/api/transactions/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const transaction = await prisma.transaction.findUnique({ where: { id } });

    if (!transaction)
      return res.status(404).send({ message: "Transação não encontrada" });

    return res.status(200).json({ transaction });
  } catch (error) {
    res.status(500).send({ message: "Erro ao buscar a transação" });
  }
});

// --------------- CREATE TRANSACTION ------------
app.post(
  "/api/transactions",
  //  requireAuth(),
  async (req, res) => {
    const { title, value, category_id, day, type } = req.body;

    // const { userId } = getAuth(req);
    // if (!userId) {
    //   return res.status(401).send({ message: "Não autorizado" });
    // }
    // console.log(userId);

    try {
      const newTransaction = await prisma.transaction.create({
        data: {
          title,
          value,
          category_id,
          type,
          day: new Date(day),
          user_id: "user_2tSZpi4m0D0TuI2mq6Zb6CwtYb3",
        },
      });
      res.status(201).json(newTransaction);
    } catch (error) {
      return res
        .status(500)
        .send({ message: "Erro ao cadastrar uma transação", error: error });
    }
  }
);

// --------------- UPDATE TRANSACTION ------------
app.put("/api/transactions/:id", async (req, res) => {
  const id = req.params.id;
  if (!id) {
    return res.status(404).send({ message: "Transação não encontrada" });
  }
  try {
    const transaction = await prisma.transaction.findUnique({ where: { id } });

    if (!transaction)
      return res.status(404).send({
        message: "Erro ao autalizar a transação. Transação não encontrada",
      });

    const data = { ...req.body };

    data.day = data.day ? new Date(data.day) : undefined;

    const updatedTransaction = await prisma.transaction.update({
      where: { id },
      data: data,
    });

    res.status(200).send({
      message: "Transação atualizada com sucesso ",
      data: updatedTransaction,
    });
  } catch (error) {
    return res.status(500).send({ message: "Erro ao atualizar a transação" });
  }
});

// --------------- DELETE TRANSACTION ------------
app.delete("/api/transactions/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const targetTransaction = await prisma.transaction.findUnique({
      where: { id },
    });
    if (!targetTransaction) {
      return res
        .status(404)
        .send({ message: "Id da transação não encontrado" });
    }

    await prisma.transaction.delete({ where: { id } });
  } catch (error) {
    res.status(500).send({ message: "Erro ao tentar deletar transação" });
  }

  res.status(200).send({ message: "Transação deletada com sucesso" });
});

// -------- FILTER ALL TRANSACTIONS BY CATEGORY --------
app.get("/api/transactions/filterAll/:categoryTitle", async (req, res) => {
  const categoryTitle = req.params.categoryTitle;

  try {
    const data = await prisma.transaction.findMany({
      include: { categories: { select: { title: true } } },
      where: {
        categories: {
          title: {
            equals: categoryTitle,
            mode: "insensitive",
          },
        },
      },
      orderBy: {
        day: "desc",
      },
    });

    setExpensesAsNegative(data);
    const resultsFinded = data.length;
    const totalValue = sumValues(data);

    res.status(200).json({ resultsFinded, totalValue, data });
  } catch (error) {
    return res.status(500).send({ message: "Erro ao filtrar por Categoria" });
  }
});

// -------- FILTER TRANSACTIONS BY MONTH AND CATEGORY -----------
app.get(
  "/api/transactions/filter/month/:category/:year/:month",
  async (req, res) => {
    const category = req.params.category;
    const month = Number(req.params.month);
    const year = Number(req.params.year);
    const initialDay = new Date(`${year}-${month}-01`);
    const finalDay =
      month !== 12
        ? new Date(`${year}-${month + 1}-01`)
        : new Date(`${year + 1}-01-01`);

    try {
      const data = await prisma.transaction.findMany({
        where: {
          AND: [
            {
              day: {
                lt: new Date(finalDay),
                gte: new Date(initialDay),
              },
            },
            {
              categories: {
                title: {
                  equals: category,
                  mode: "insensitive",
                },
              },
            },
          ],
        },
        orderBy: { day: "desc" },
      });

      setExpensesAsNegative(data);
      const resultsFinded = data.length;
      const totalValue = sumValues(data);

      res.status(200).json({ resultsFinded, totalValue, data });
    } catch (error) {
      return res
        .status(500)
        .send({ message: "Erro ao Filtrar por categoria e mês" });
    }
  }
);

// -------- FILTER TRANSACTIONS BY MONTH -----------
app.get("/api/transactions/filter/:year/:month", async (req, res) => {
  const month = Number(req.params.month);
  const year = Number(req.params.year);
  const initialDay = new Date(`${year}-${month}-01`);
  const finalDay =
    month !== 12
      ? new Date(`${year}-${Number(month) + 1}-01`)
      : new Date(`${year + 1}-01-01`);

  try {
    const data = await prisma.transaction.findMany({
      where: {
        day: {
          lt: new Date(finalDay),
          gte: new Date(initialDay),
        },
      },
      orderBy: [{ day: "desc" }, { id: "desc" }],
    });
    setExpensesAsNegative(data);

    const balance = getBalance(data);

    res.status(200).json({ balance, data });
  } catch (error) {
    return res.status(500).send({ message: "Erro ao filtrar por mês" });
  }
});

// -------- FILTER TRANSACTIONS BY NAME ------------
app.get("/api/transactions/filterTitle/:title", async (req, res) => {
  const title = req.params.title;

  try {
    const data = await prisma.transaction.findMany({
      where: { title: { contains: title, mode: "insensitive" } },
      orderBy: { day: "desc" },
    });

    setExpensesAsNegative(data);

    const resultsFinded = data.length;

    const totalValue = sumValues(data);

    return res.json({ resultsFinded, totalValue, data });
  } catch (error) {
    return res.status(500).send({ message: "Error ao Pesquisar pelo titulo" });
  }
});

// -------- GROUP BY CATEGORY ------------
app.get("/api/transactions/categories/:year/:month/:type", async (req, res) => {
  const year = Number(req.params.year);
  const month = Number(req.params.month);
  const transactionType = Number(req.params.type);
  const initialDay = new Date(`${year}-${month}-01`);
  const finalDay =
    month !== 12
      ? new Date(`${year}-${month + 1}-01`)
      : new Date(`${year + 1}-01-01`);

  try {
    const data = await prisma.$queryRaw`
      select  c.title Category, c.id, sum(t.value)
      from transactions t 
      left outer join categories c on c.id = t.category_id 
      where t.day between ${initialDay} and ${finalDay} and t.type = ${transactionType}
      group by c.id, c.title 
      order by c.id
    `;

    res.status(200).json(data);
  } catch (error) {
    return res.status(500).send({ message: "Erros ao agrupar por categorias" });
  }
});

// -------- GET PATRIMONY ------------
app.get("/api/transactions/patrimony/:year/:month", async (req, res) => {
  const year = Number(req.params.year);
  const month = Number(req.params.month);
  const finalDay =
    month !== 12
      ? new Date(`${year}-${month + 1}-01`)
      : new Date(`${year + 1}-01-01`);

  try {
    const data = await prisma.transaction.findMany({
      where: {
        day: {
          lt: new Date(finalDay),
        },
      },
      orderBy: [{ day: "desc" }, { id: "desc" }],
    });
    setExpensesAsNegative(data);
    const totalValue = sumValues(data);
    const balance = getBalance(data);

    res.status(200).json({ totalValue, balance, data });
  } catch (error) {
    return res.status(500).send({ message: "Erro ao Somar patrimonio" });
  }
});

// --------------- START SERVER------------------
app.listen(port, () => {
  console.log("Server started on port 3333");
});

function getBalance(
  filterResult: {
    id: string;
    title: string | null;
    value: number | null;
    day: Date | null;
    category_id: number | null;
    type: number | null;
  }[]
) {
  const balance = { incomes: 0, expenses: 0, result: 0 };
  for (const item of filterResult) {
    if (item.type === 1) balance.incomes += item.value!;
    if (item.type === 0) balance.expenses += item.value!;
  }
  balance.result = balance.incomes + balance.expenses;
  return balance;
}

type TransactionType = {
  id: string;
  title: string | null;
  value: number | null;
  day: Date | null;
  category_id: number | null;
  type: number | null;
  user_id: string | "user_2tSZpi4m0D0TuI2mq6Zb6CwtYb3";
};

function sumValues(
  filterResult: TransactionType[]
) {
  let totalValue = 0;
  for (const item of filterResult) {
    totalValue += item.value!;
  }
  return totalValue;
}

function setExpensesAsNegative(
  filterResult: TransactionType[]
) {
  for (const item of filterResult) {
    if (item.type === 0) {
      item.value! *= -1;
    }
  }
}

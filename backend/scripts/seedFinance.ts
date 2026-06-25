import { prisma } from "../db";

function daysAgo(days: number): Date {
    const date = new Date();
    date.setDate(date.getDate() - days);
    date.setHours(0, 0, 0, 0);
    return date;
}

function daysFromNow(days: number): Date {
    const date = new Date();
    date.setDate(date.getDate() + days);
    date.setHours(0, 0, 0, 0);
    return date;
}

async function seedFinance() {
    const existing = await prisma.financeAccount.count();
    if (existing > 0) {
        console.log("Finance data already seeded — skipping.");
        return;
    }

    const mainBank = await prisma.financeAccount.create({
        data: {
            name: "Main Bank Account",
            accountType: "BANK",
            currency: "EGP",
            openingBalance: 25000,
            description: "Primary club operating account",
        },
    });

    const pettyCash = await prisma.financeAccount.create({
        data: {
            name: "Petty Cash",
            accountType: "CASH",
            currency: "EGP",
            openingBalance: 1500,
            description: "On-hand cash for small expenses",
        },
    });

    const transactions = [
        { accountId: mainBank.id, type: "INCOME", amount: 12000, category: "Sponsorship", description: "Annual sponsor contribution", days: 90 },
        { accountId: mainBank.id, type: "INCOME", amount: 4500, category: "Event Revenue", description: "Spring gala ticket sales", days: 75 },
        { accountId: mainBank.id, type: "EXPENSE", amount: 3200, category: "Venue", description: "Event hall rental", days: 70 },
        { accountId: mainBank.id, type: "EXPENSE", amount: 1800, category: "Marketing", description: "Social media campaign", days: 65 },
        { accountId: pettyCash.id, type: "EXPENSE", amount: 250, category: "Supplies", description: "Printing materials", days: 60 },
        { accountId: mainBank.id, type: "INCOME", amount: 2800, category: "Membership Fees", description: "Semester membership dues", days: 55 },
        { accountId: mainBank.id, type: "EXPENSE", amount: 950, category: "Catering", description: "Workshop refreshments", days: 50 },
        { accountId: mainBank.id, type: "EXPENSE", amount: 1400, category: "Equipment", description: "AV equipment rental", days: 45 },
        { accountId: pettyCash.id, type: "INCOME", amount: 400, category: "Event Revenue", description: "On-site merchandise sales", days: 42 },
        { accountId: mainBank.id, type: "EXPENSE", amount: 2200, category: "Venue", description: "Training room booking", days: 38 },
        { accountId: mainBank.id, type: "INCOME", amount: 6000, category: "Sponsorship", description: "Partner workshop grant", days: 35 },
        { accountId: mainBank.id, type: "EXPENSE", amount: 1100, category: "Transport", description: "Field trip bus", days: 32 },
        { accountId: mainBank.id, type: "EXPENSE", amount: 750, category: "Supplies", description: "Lab consumables", days: 28 },
        { accountId: pettyCash.id, type: "EXPENSE", amount: 120, category: "Supplies", description: "Stationery", days: 25 },
        { accountId: mainBank.id, type: "INCOME", amount: 3500, category: "Event Revenue", description: "Workshop registration fees", days: 22 },
        { accountId: mainBank.id, type: "EXPENSE", amount: 1600, category: "Marketing", description: "Poster printing", days: 20 },
        { accountId: mainBank.id, type: "EXPENSE", amount: 900, category: "Catering", description: "Networking night snacks", days: 18 },
        { accountId: mainBank.id, type: "INCOME", amount: 2000, category: "Donations", description: "Alumni donation", days: 15 },
        { accountId: mainBank.id, type: "EXPENSE", amount: 4500, category: "Equipment", description: "Project hardware kits", days: 12 },
        { accountId: pettyCash.id, type: "EXPENSE", amount: 80, category: "Transport", description: "Courier delivery", days: 10 },
        { accountId: mainBank.id, type: "INCOME", amount: 1500, category: "Event Revenue", description: "Late registration fees", days: 8 },
        { accountId: mainBank.id, type: "EXPENSE", amount: 2100, category: "Venue", description: "Seminar room", days: 6 },
        { accountId: mainBank.id, type: "EXPENSE", amount: 650, category: "Marketing", description: "Email campaign tools", days: 4 },
        { accountId: mainBank.id, type: "INCOME", amount: 800, category: "Membership Fees", description: "New member fees", days: 2 },
        { accountId: pettyCash.id, type: "EXPENSE", amount: 200, category: "Catering", description: "Team meeting snacks", days: 1 },
    ];

    for (const tx of transactions) {
        await prisma.financeTransaction.create({
            data: {
                accountId: tx.accountId,
                type: tx.type,
                amount: tx.amount,
                category: tx.category,
                description: tx.description,
                transactionDate: daysAgo(tx.days),
            },
        });
    }

    await prisma.financeLiability.createMany({
        data: [
            {
                creditor: "AV Rental Co.",
                description: "Outstanding invoice for annual summit equipment",
                totalAmount: 4500,
                paidAmount: 2000,
                dueDate: daysFromNow(14),
                status: "ACTIVE",
                currency: "EGP",
                accountId: mainBank.id,
            },
            {
                creditor: "Campus Services",
                description: "Venue deposit for summer conference",
                totalAmount: 8000,
                paidAmount: 8000,
                dueDate: daysAgo(5),
                status: "PAID",
                currency: "EGP",
                accountId: mainBank.id,
            },
            {
                creditor: "Print House",
                description: "Marketing collateral batch",
                totalAmount: 1200,
                paidAmount: 400,
                dueDate: daysAgo(3),
                status: "ACTIVE",
                currency: "EGP",
                accountId: mainBank.id,
            },
        ],
    });

    await prisma.financeScheduledItem.createMany({
        data: [
            {
                title: "Sponsor installment — MedTech Partners",
                type: "INCOME",
                amount: 5000,
                dueDate: daysFromNow(7),
                accountId: mainBank.id,
                recurrence: null,
            },
            {
                title: "Venue final payment — Summer Conference",
                type: "EXPENSE",
                amount: 3500,
                dueDate: daysFromNow(21),
                accountId: mainBank.id,
                recurrence: null,
            },
            {
                title: "Monthly cloud hosting",
                type: "EXPENSE",
                amount: 350,
                dueDate: daysFromNow(5),
                accountId: mainBank.id,
                recurrence: "MONTHLY",
            },
            {
                title: "Membership fee collection",
                type: "INCOME",
                amount: 2200,
                dueDate: daysFromNow(30),
                accountId: mainBank.id,
                recurrence: null,
            },
            {
                title: "Petty cash replenishment",
                type: "EXPENSE",
                amount: 500,
                dueDate: daysFromNow(10),
                accountId: pettyCash.id,
                recurrence: null,
            },
        ],
    });

    console.log("Finance seed data created successfully.");
}

seedFinance()
    .catch((error) => {
        console.error("Finance seed failed:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

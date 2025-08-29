import bcrypt from 'bcrypt';
import postgres from 'postgres';
import { invoices, customers, revenue, users } from '../lib/placeholder-data';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

async function seedUsers() {
  console.log('🌱 Starting seedUsers...');
  await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
  console.log('✅ Created uuid-ossp extension');
  
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    );
  `;
  console.log('✅ Created users table');

  const insertedUsers = await Promise.all(
    users.map(async (user) => {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      return sql`
        INSERT INTO users (id, name, email, password)
        VALUES (${user.id}, ${user.name}, ${user.email}, ${hashedPassword})
        ON CONFLICT (id) DO NOTHING;
      `;
    }),
  );
  console.log(`✅ Inserted ${insertedUsers.length} users`);

  return insertedUsers;
}

async function seedInvoices() {
  console.log('🌱 Starting seedInvoices...');
  await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;

  await sql`
    CREATE TABLE IF NOT EXISTS invoices (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      customer_id UUID NOT NULL,
      amount INT NOT NULL,
      status VARCHAR(255) NOT NULL,
      date DATE NOT NULL
    );
  `;
  console.log('✅ Created invoices table');

  const insertedInvoices = await Promise.all(
    invoices.map(
      (invoice) => sql`
        INSERT INTO invoices (customer_id, amount, status, date)
        VALUES (${invoice.customer_id}, ${invoice.amount}, ${invoice.status}, ${invoice.date})
        ON CONFLICT (id) DO NOTHING;
      `,
    ),
  );
  console.log(`✅ Inserted ${insertedInvoices.length} invoices`);

  return insertedInvoices;
}

async function seedCustomers() {
  console.log('🌱 Starting seedCustomers...');
  await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;

  await sql`
    CREATE TABLE IF NOT EXISTS customers (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      image_url VARCHAR(255) NOT NULL
    );
  `;
  console.log('✅ Created customers table');

  const insertedCustomers = await Promise.all(
    customers.map(
      (customer) => sql`
        INSERT INTO customers (id, name, email, image_url)
        VALUES (${customer.id}, ${customer.name}, ${customer.email}, ${customer.image_url})
        ON CONFLICT (id) DO NOTHING;
      `,
    ),
  );
  console.log(`✅ Inserted ${insertedCustomers.length} customers`);

  return insertedCustomers;
}

async function seedRevenue() {
  console.log('🌱 Starting seedRevenue...');
  await sql`
    CREATE TABLE IF NOT EXISTS revenue (
      month VARCHAR(4) NOT NULL UNIQUE,
      revenue INT NOT NULL
    );
  `;
  console.log('✅ Created revenue table');

  const insertedRevenue = await Promise.all(
    revenue.map(
      (rev) => sql`
        INSERT INTO revenue (month, revenue)
        VALUES (${rev.month}, ${rev.revenue})
        ON CONFLICT (month) DO NOTHING;
      `,
    ),
  );
  console.log(`✅ Inserted ${insertedRevenue.length} revenue records`);

  return insertedRevenue;
}

async function seedScrapedContent() {
  console.log('🌱 Starting seedScrapedContent...');
  await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
  
  await sql`
    CREATE TABLE IF NOT EXISTS scraped_content (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      url TEXT UNIQUE NOT NULL,
      title TEXT,
      content TEXT,
      scraped_at TIMESTAMP DEFAULT NOW(),
      chunk_count INTEGER,
      status TEXT DEFAULT 'pending'
    );
  `;
  console.log('✅ Created scraped_content table');

  // No initial data to seed for scraped_content table
  console.log('✅ No data to insert for scraped_content');
  return [];
}

async function seedContentChunks() {
  console.log('🌱 Starting seedContentChunks...');
  await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
  
  await sql`
    CREATE TABLE IF NOT EXISTS content_chunks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      content_id UUID REFERENCES scraped_content(id),
      chunk_text TEXT NOT NULL,
      chunk_index INTEGER,
      pinecone_id TEXT UNIQUE,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `;
  console.log('✅ Created content_chunks table');

  // No initial data to seed for content_chunks table
  console.log('✅ No data to insert for content_chunks');
  return [];
}

export async function GET() {
  console.log('🚀 Starting database seeding...');
  try {
    const result = await sql.begin(async (sql) => {
      console.log('📦 Starting database transaction...');
      const results = await Promise.all([
        seedUsers(),
        seedCustomers(),
        seedInvoices(),
        seedRevenue(),
        seedScrapedContent(),
        seedContentChunks(),
      ]);
      console.log('✅ All seeding functions completed');
      return results;
    });

    console.log('🎉 Database seeded successfully!');
    return Response.json({ message: 'Database seeded successfully' });
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    return Response.json({ error }, { status: 500 });
  }
}

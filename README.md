# My First Project

A full-stack Next.js application deployed on Vercel and Render, with Supabase for the database.

## Tech Stack

- **Frontend**: Next.js 14 + React 18 + TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Vercel (Frontend) + Render (Backend)
- **Authentication**: Supabase Auth

## Prerequisites

- Node.js 18+ and npm
- Git
- GitHub account
- Supabase account
- Vercel account
- Render account

## Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/manihappy84-ig/MyFirstProject.git
cd MyFirstProject
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy `.env.example` to `.env.local` and add your Supabase credentials:

```bash
cp .env.example .env.local
```

Then edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT_ID].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Get these from your [Supabase Dashboard](https://supabase.com/dashboard/project/eabfvodnnlrhdlsjmaog/settings/api)

### 4. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` in your browser.

## Deployment

### Vercel

1. Go to [Vercel New](https://vercel.com/new?teamSlug=manihappy84-igs-projects)
2. Import your GitHub repository
3. Add environment variables from `.env.local`
4. Click Deploy

### Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New" → "Web Service"
3. Connect your GitHub repo
4. Select the `render.yaml` configuration
5. Add environment variables
6. Click Deploy

### Supabase

1. Go to your [Supabase Project](https://supabase.com/dashboard/project/eabfvodnnlrhdlsjmaog)
2. Create tables as needed
3. Enable authentication if required

## Project Structure

```
.
├── app/
│   ├── api/                 # API routes
│   │   └── health/          # Health check endpoint
│   ├── page.tsx             # Home page
│   ├── layout.tsx           # Root layout
│   └── globals.css          # Global styles
├── public/                  # Static assets
├── package.json             # Dependencies
├── tsconfig.json            # TypeScript config
├── tailwind.config.ts       # Tailwind CSS config
├── next.config.js           # Next.js config
├── vercel.json              # Vercel deployment config
├── render.yaml              # Render deployment config
└── README.md                # This file
```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Create production build
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## API Endpoints

- `GET /api/health` - Health check endpoint

## Environment Variables

### Required

- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key

### Optional

- `SUPABASE_SERVICE_ROLE_KEY` - For server-side operations

## Development Tips

1. Use TypeScript for type safety
2. Follow Next.js best practices
3. Use Tailwind CSS for styling
4. Commit frequently to GitHub
5. Test locally before deploying

## Troubleshooting

### Build fails on Vercel/Render

- Check all environment variables are set correctly
- Ensure Node.js version is 18+
- Check the build logs for specific errors

### Database connection issues

- Verify Supabase credentials are correct
- Check that your IP is allowed in Supabase firewall settings
- Test connection with the Supabase dashboard

## License

MIT

## Support

For issues or questions:
- Check [Next.js docs](https://nextjs.org/docs)
- Check [Supabase docs](https://supabase.com/docs)
- Raise an issue on [GitHub](https://github.com/manihappy84-ig/MyFirstProject/issues)

---

**Last Updated**: March 2024

# ai2026 - PDF Converter & Unlock Tool

A modern web application for converting PDFs to Text or Word documents, and unlocking password-protected PDFs. Built with Next.js 14, React, and Tailwind CSS.

## Features

✨ **PDF to Text** - Extract text from any PDF file
📄 **PDF to Word** - Convert PDFs to editable DOCX files
🔓 **Unlock PDF** - Remove password protection from encrypted PDFs
⚡ **Fast Processing** - Instant conversions
🔒 **Secure** - Files processed locally, no server storage
📱 **Responsive** - Works on desktop, tablet, and mobile
🆓 **Free** - No registration required

## Tech Stack

- **Frontend**: Next.js 14 + React 18 + TypeScript
- **Styling**: Tailwind CSS
- **PDF Processing**: pdfjs-dist, pdf-lib, pdfrw
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Vercel + Render

## Prerequisites

- Node.js 18+ and npm
- Git
- GitHub account

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

```bash
cp .env.example .env.local
```

Edit `.env.local` with your Supabase credentials (optional for PDF features):

```env
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT_ID].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### 4. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` in your browser.

## Project Structure

```
ai2026/
├── app/
│   ├── api/
│   │   ├── convert/
│   │   │   ├── to-text/route.ts      # PDF to Text conversion
│   │   │   ├── to-word/route.ts      # PDF to Word conversion
│   │   │   ├── unlock/route.ts       # PDF unlock/password removal
│   │   │   └── health/route.ts       # Health check
│   │   └── ...
│   ├── page.tsx                      # Home page with converter
│   ├── layout.tsx                    # Root layout
│   └── globals.css                   # Global styles
├── components/
│   ├── PDFConverterTool.tsx          # Main converter component
│   ├── PDFUploader.tsx               # File upload component
│   └── PasswordInput.tsx             # Password input component
├── lib/
│   └── pdf/
│       └── utils.ts                  # PDF processing utilities
├── public/                           # Static assets
├── package.json                      # Dependencies
├── tsconfig.json                     # TypeScript config
├── tailwind.config.ts                # Tailwind CSS config
├── next.config.js                    # Next.js config
├── vercel.json                       # Vercel deployment config
├── render.yaml                       # Render deployment config
└── README.md                         # This file
```

## API Endpoints

### GET /api/health
Health check endpoint

### POST /api/convert/to-text
Convert PDF to text
- **Body**: FormData with `file` field
- **Returns**: JSON with extracted text

### POST /api/convert/to-word
Convert PDF to Word document
- **Body**: FormData with `file` field
- **Returns**: DOCX file as binary

### POST /api/convert/unlock
Remove password from PDF
- **Body**: FormData with `file` and `password` fields
- **Returns**: Unlocked PDF as binary

## Development

### Scripts

- `npm run dev` - Start development server
- `npm run build` - Create production build
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Adding Features

1. Create new API routes in `app/api/`
2. Create UI components in `components/`
3. Add utility functions in `lib/`
4. Update styles in `app/globals.css` or component files

## Deployment

### Vercel (Recommended for Frontend)

```bash
# Push to GitHub, then:
# 1. Go to vercel.com/new
# 2. Import your repository
# 3. Add environment variables
# 4. Deploy
```

### Render (Alternative Backend Hosting)

```bash
# 1. Go to render.com
# 2. Create new Web Service
# 3. Connect GitHub repository
# 4. Use render.yaml configuration
# 5. Add environment variables and deploy
```

## Security & Privacy

- Files are processed in-memory, not stored on server
- No file uploads to external services
- All processing happens server-side or client-side
- Use HTTPS in production
- Consider rate limiting for API endpoints

## Troubleshooting

### Large PDF files fail
- Check file size limits (max 50MB)
- Increase Node.js memory if needed
- Consider splitting large PDFs

### Password unlock not working
- Verify the correct password
- Some PDFs use encryption that requires specific libraries
- Try alternative PDF tools if persistent

### Build fails in production
- Check all environment variables are set
- Verify Node.js version >= 18
- Review build logs for specific errors

## Environment Variables

### Required for Full Features
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key

### Optional
- `SUPABASE_SERVICE_ROLE_KEY` - For server-side operations
- `NEXT_PUBLIC_API_URL` - API endpoint (default: http://localhost:3000)

## Performance Tips

1. Enable compression in production
2. Use CDN for static assets
3. Implement request queuing for large files
4. Cache converted results if needed
5. Monitor API endpoint performance

## Future Enhancements

- [ ] Batch file conversion
- [ ] PDF merging
- [ ] Image extraction from PDFs
- [ ] Watermark addition
- [ ] PDF splitting
- [ ] Cloud storage integration
- [ ] Conversion history
- [ ] Advanced authentication

## License

MIT - Feel free to use this project for personal or commercial purposes

## Support

For issues or questions:
- GitHub Issues: https://github.com/manihappy84-ig/MyFirstProject/issues
- Email: support@ai2026.com
- Documentation: Check the SETUP_CHECKLIST.md for detailed setup guide

## Changelog

### v0.1.0 (Current)
- Initial release
- PDF to Text conversion
- PDF to Word conversion (basic)
- PDF password removal
- Responsive UI with Tailwind CSS
- API routes for all features

---

**Project**: ai2026  
**Version**: 0.1.0  
**Last Updated**: March 2026  
**Status**: Active Development


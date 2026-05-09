# CryptoTruth

AI-powered due diligence platform for analyzing cryptocurrency Key Opinion Leaders (KOLs) and Twitter influencers.

## Features

- **Trust Score Analysis** - AI-driven reputation scoring (0-100) based on track record
- **Google Search Grounding** - Real-time fact-checking using Gemini 2.0 Flash's built-in search
- **Track Record Verification** - Identify successful predictions vs. failed calls
- **Controversy Detection** - Surface rug pulls, scams, and paid promotions via web search
- **Evidence Sources** - Provides links to sources backing up claims (ZachXBT, Coffeezilla, Reddit, etc.)
- **Event Timeline** - Visual timeline of significant events
- **Multi-language Support** - English and Traditional Chinese (zh-TW)
- **Caching** - 24-hour caching for performance optimization
- **Rate Limiting** - Built-in protection (10 requests/hour per IP)

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Vite
- **AI**: Google Gemini 2.0 Flash with Google Search grounding
- **Backend**: Vercel Serverless Functions
- **Caching**: Vercel Blob Storage
- **i18n**: Built-in language support (English, Traditional Chinese)

## How It Works

CryptoTruth uses Gemini 2.0 Flash's Google Search grounding capability to perform real-time fact-checking. When you search for a KOL, the AI:

1. Searches for investigations by crypto detectives like ZachXBT
2. Looks for coverage by investigators like Coffeezilla
3. Finds community discussions on Reddit r/CryptoCurrency
4. Identifies scam allegations, rug pulls, and fraud reports
5. Detects patterns of undisclosed paid promotions

This approach allows the AI to discover information across the entire web rather than being limited to a single data source.

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Google Gemini API key ([Get one here](https://aistudio.google.com/app/apikey))

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/verify1st.git
   cd verify1st
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file with your API key:
   ```bash
   cp .env.example .env.local
   ```
   Then edit `.env.local` and add your Gemini API key.

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Your Google Gemini API key |
| `BLOB_READ_WRITE_TOKEN` | For production | Vercel Blob storage token (auto-configured on Vercel) |
| `RATE_LIMIT_BACKEND` | No | `memory` by default to avoid Blob advanced operations; set `blob` only if you need shared Blob-backed limits |
| `ML_DATA_BLOB_ENABLED` | No | `false` by default; set `true` to write full ML records to Blob |
| `ML_DATA_SAMPLE_RATE` | No | `0`-`1` sampling rate for ML Blob records when enabled |
| `BLOB_PUBLIC_BASE_URL` | No | Optional public Blob base URL override for cache reads |

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import the repository in [Vercel](https://vercel.com)
3. Add your `GEMINI_API_KEY` as an environment variable
4. Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/verify1st)

### Manual Build

```bash
npm run build
npm run preview
```

## Project Structure

```
verify1st/
├── api/
│   └── analyze.ts        # Serverless API endpoint with Google Search grounding
├── components/
│   ├── HistoryTimeline.tsx
│   ├── SearchInput.tsx
│   └── TrustMeter.tsx
├── services/
│   └── geminiService.ts  # Frontend service for API calls
├── public/
├── App.tsx
├── index.tsx
├── types.ts
└── vite.config.ts
```

## API Rate Limits

- **10 requests per hour** per IP address
- Results are cached for **24 hours**
- Rate limit resets every hour

## Disclaimer

This tool provides AI-generated analysis based on publicly available information. It should not be considered financial advice. Always do your own research before making investment decisions. The accuracy of the analysis depends on the AI model and available web data.

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## Security

For security vulnerabilities, please see our [Security Policy](SECURITY.md).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Powered by [Google Gemini](https://ai.google.dev/) with Google Search grounding
- Built with [React](https://react.dev/) and [Vite](https://vitejs.dev/)
- Deployed on [Vercel](https://vercel.com/)

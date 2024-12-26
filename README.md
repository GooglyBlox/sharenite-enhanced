<div align="center">
<img src="public/sharenite-enhanced-logo.png" alt="Sharenite Enhanced Logo" width="96" height="96" style="vertical-align: middle" />

# Sharenite Enhanced
A modern, enhanced interface for viewing and managing your Sharenite game library.
</div>

## Features
- Grid and list views for your game collection
- Game cover art integration via IGDB
- Real-time updates and caching
- Detailed game statistics and playtime tracking
- Profile sharing capabilities
- Responsive design
- Dark mode by default

## Setup
1. Clone the repository:
```bash
git clone https://github.com/GooglyBlox/sharenite-enhanced.git
```

2. Install dependencies:
```bash
npm install
```

3. Get your IGDB API credentials:
   - Go to [Twitch Developers](https://dev.twitch.tv/console/apps)
   - Sign in with your Twitch account (create one if needed)
   - Click "Register Your Application"
   - Set Name to "Sharenite Enhanced"
   - Set OAuth Redirect URL to `http://localhost:3000`
   - Set Category to "Website Integration"
   - Once registered, you'll get your Client ID
   - Generate a Client Secret from your new application's page

4. Create a `.env` file with the following:
```
IGDB_CLIENT_ID=your_client_id
IGDB_CLIENT_SECRET=your_client_secret
NEXT_PUBLIC_APP_URL=your_deployment_url
```

5. Start the development server:
```bash
npm run dev
```

## Deployment
Deploy easily with [Vercel](https://vercel.com):

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FGooglyBlox%2Fsharenite-enhanced)

Or build for production:
```bash
npm run build
npm run start
```

## Usage
1. Visit the app
2. Enter your Sharenite profile URL
3. Ensure your Sharenite profile is public
4. Browse and manage your game collection

## Related Links
- Official Sharenite Website: https://www.sharenite.link
- Sharenite GitHub Repository: https://github.com/sharenite/sharenite
- Playnite Addon: https://github.com/sharenite/playnite-sharenite

## License
MIT

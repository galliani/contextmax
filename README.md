# Nuxt Minimal Starter

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Analytics Configuration

This project supports both Umami and PostHog analytics. To enable them, create a `.env` file in the project root with the following variables:

```bash
# Umami Analytics Configuration
# Get these values from your Umami dashboard
NUXT_PUBLIC_UMAMI_URL=https://your-umami-instance.com/script.js
NUXT_PUBLIC_UMAMI_WEBSITE_ID=your-website-id-here

# PostHog Analytics Configuration  
# Get these values from your PostHog project settings
NUXT_PUBLIC_POSTHOG_KEY=your-posthog-public-key-here
NUXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

# Note: For EU users, use https://eu.i.posthog.com for PostHog host
# Leave any value empty to disable that analytics service
```

### Umami Setup
1. Set up your Umami instance or use Umami Cloud
2. Create a website in your Umami dashboard
3. Copy the tracking script URL and website ID
4. Add them to your `.env` file

### PostHog Setup
1. Create a PostHog account (free tier available)
2. Get your public API key from Project Settings
3. Choose the appropriate host (US or EU)
4. Add them to your `.env` file

The analytics will automatically:
- Track page views on route changes
- Provide helper functions for custom event tracking
- Respect user privacy settings (Do Not Track)
- Only load and track when environment variables are configured

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

**Note:** To enable analytics tracking, create a `.env` file in the project root with the environment variables listed in the Analytics Configuration section above.

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.
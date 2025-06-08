# News in a Nutshell - Podcast Website

A modern Jekyll website for the "News in a Nutshell" podcast by Bojack Sanchez. This site features an interactive 3D sound wave animation background and automatically fetches episodes from the podcast RSS feed.

## Features

- 🎨 **Modern Design**: Clean, professional layout with animated 3D sound waves
- 📱 **Responsive**: Optimized for all screen sizes
- 🎙️ **RSS Integration**: Automatically fetches and displays episodes from your podcast RSS feed
- 🔍 **Episode Search**: Find episodes by title or description
- 📄 **Pagination**: Browse through all episodes with easy navigation
- ⚡ **Fast Loading**: Optimized for performance
- 🚀 **GitHub Pages Ready**: Automatic deployment via GitHub Actions

## Quick Start

### 1. Repository Setup

1. Fork or clone this repository
2. Update the repository name to match your desired GitHub Pages URL
3. Enable GitHub Pages in your repository settings:
   - Go to Settings → Pages
   - Select "GitHub Actions" as the source

### 2. Configuration

Edit `_config.yml` to customize your site:

```yaml
title: "Your Podcast Name"
description: "Your podcast description"
author: "Your Name"
email: "your@email.com"
url: "https://yourusername.github.io"
rss_feed_url: "https://your-rss-feed-url.com/feed.rss"
```

### 3. Content Customization

- **Homepage**: Edit `index.html` to update the hero section and about content
- **About Page**: Modify `about.html` with your podcast story
- **Styling**: Customize colors and fonts in `assets/css/styles.css`
- **RSS Feed**: Update the RSS URL in `assets/js/rss-parser.js` if needed

### 4. Local Development

To run the site locally:

```bash
# Install Ruby dependencies
bundle install

# Start the Jekyll server
bundle exec jekyll serve

# Visit http://localhost:4000
```

## File Structure

```
├── _config.yml                 # Jekyll configuration
├── _layouts/
│   └── default.html            # Main page template
├── assets/
│   ├── css/
│   │   └── styles.css          # Main stylesheet
│   ├── js/
│   │   ├── app.js              # 3D animation and interactions
│   │   └── rss-parser.js       # RSS feed parser
│   └── favicon.svg             # Site favicon
├── .github/workflows/
│   └── jekyll-gh-pages.yml     # GitHub Pages deployment
├── index.html                  # Homepage
├── episodes.html               # All episodes page
├── about.html                  # About page
├── Gemfile                     # Ruby dependencies
└── README.md                   # This file
```

## RSS Feed Integration

The site automatically fetches episodes from your RSS feed. Make sure your RSS feed includes:

- Episode titles
- Descriptions
- Publication dates
- Duration (optional)
- Episode links

The RSS parser uses a CORS proxy to fetch the feed. If you experience issues, you may need to:

1. Enable CORS on your RSS hosting
2. Use a different proxy service
3. Implement server-side RSS parsing

## Customization

### Colors

Update the CSS custom properties in `assets/css/styles.css`:

```css
:root {
    --primary-color: #FF6B6B;
    --secondary-color: #4ECDC4;
    --accent-color: #45B7D1;
    /* ... other colors */
}
```

### Typography

The site uses 'Space Grotesk' font by default. To change:

1. Update the Google Fonts link in `_layouts/default.html`
2. Modify the `font-family` in `assets/css/styles.css`

### 3D Animation

The sound wave animation can be customized in `assets/js/app.js`:

- Wave colors
- Animation speed
- Wave count and size
- Interaction effects

## Deployment

### GitHub Pages (Recommended)

1. Push your changes to the `main` branch
2. GitHub Actions will automatically build and deploy your site
3. Your site will be available at `https://yourusername.github.io/repository-name`

### Manual Deployment

```bash
# Build the site
bundle exec jekyll build

# Deploy the _site folder to your hosting provider
```

## Dependencies

- **Jekyll**: Static site generator
- **GitHub Pages**: Hosting platform
- **Three.js**: 3D graphics library
- **GSAP**: Animation library

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge

Note: 3D animations require WebGL support.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally
5. Submit a pull request

## License

This project is open source and available under the MIT License.

## Support

For questions or issues:

- Create an issue in this repository
- Contact: {{ site.email }}

---

**Stay updated. Stay entertained. Stay downloaded.** 
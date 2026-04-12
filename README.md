# Content Marketing Services API

A RESTful API for managing content marketing operations including content creation, campaign management, and analytics.

## Features

- **Authentication** - JWT-based auth with role-based access control (admin, editor, viewer)
- **Content Management** - Create and manage articles, blogs, social posts, emails, video scripts, and infographics
- **Campaign Management** - Plan and track marketing campaigns with budget and audience targeting
- **Analytics** - Overview stats, campaign performance, and top-performing content

## Getting Started

### Prerequisites

- Node.js >= 16
- MongoDB

### Installation

```bash
cp .env.example .env
# Edit .env with your configuration
npm install
npm run dev
```

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server port | `3000` |
| `MONGODB_URI` | MongoDB connection string | - |
| `JWT_SECRET` | JWT signing secret | - |
| `JWT_EXPIRES_IN` | Token expiry | `7d` |

## API Endpoints

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login and receive JWT |
| GET | `/api/auth/me` | Get current user |

### Content
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/content` | List all content (with filters) |
| GET | `/api/content/:id` | Get content by ID |
| POST | `/api/content` | Create new content |
| PUT | `/api/content/:id` | Update content |
| DELETE | `/api/content/:id` | Delete content |

**Content Types:** `article`, `blog`, `social_post`, `email`, `video_script`, `infographic`

**Content Statuses:** `draft`, `review`, `published`, `archived`

### Campaigns
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/campaigns` | List all campaigns |
| GET | `/api/campaigns/:id` | Get campaign with its content |
| POST | `/api/campaigns` | Create new campaign |
| PUT | `/api/campaigns/:id` | Update campaign |
| DELETE | `/api/campaigns/:id` | Delete campaign (admin only) |

**Campaign Channels:** `email`, `social`, `blog`, `seo`, `paid`, `other`

### Analytics
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/analytics/overview` | Platform-wide stats |
| GET | `/api/analytics/campaigns/:id` | Campaign performance |
| GET | `/api/analytics/top-content` | Top performing content |

## Role Permissions

| Role | Permissions |
|---|---|
| `admin` | Full access |
| `editor` | Create, read, update content & campaigns |
| `viewer` | Read-only access |

## License

MIT

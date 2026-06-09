export default () => ({
  port: parseInt(process.env.PORT || '3001', 10),
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/pubg_stats?schema=public',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  pubg: {
    apiKey: process.env.PUBG_API_KEY,
    baseUrl: process.env.PUBG_API_BASE || 'https://api.pubg.com/shards/steam',
  },
  ai: {
    apiKey: process.env.AI_API_KEY,
    baseUrl: process.env.AI_API_BASE || 'https://api.openai.com/v1',
    model: process.env.AI_MODEL || 'gpt-4o',
  },
});

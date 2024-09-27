import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  generatePremiumSlug,
  generateSlug,
  getOriginalUrl,
  premiumUrlMiddleware,
  isValidUrl,
  protect,
  updateClick,
} from "./handler";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.use(cors());

app.get("/:slug", async (c) => {
  const slug = c.req.param("slug");
  if (!slug || slug === "") {
    return c.json({ error: "No slug provided" }, 400);
  }
  try {
    const originalUrl = await getOriginalUrl(c, slug);
    if (originalUrl === "") {
      return c.json({ error: "Item not found" }, 404);
    }
    c.executionCtx.waitUntil(updateClick(c, slug));
    return c.redirect(originalUrl);
  } catch (e) {
    return c.json({ error: "Internal server error" }, 500);
  }
});

app.post("/api", protect, async (c) => {
  const { originalUrl } = await c.req.json();
  if (!originalUrl || originalUrl === "") {
    return c.json({ error: "No URL provided" }, 400);
  }
  if (!isValidUrl(originalUrl)) {
    return c.json({ error: "Invalid URL" }, 400);
  }
  const shortUrl = await generateSlug(c, originalUrl);
  return c.json({ shortUrl });
});

app.post("/pro", protect, premiumUrlMiddleware(generatePremiumSlug, false));
app.put("/pro", protect, premiumUrlMiddleware(generatePremiumSlug, true));

export default app;

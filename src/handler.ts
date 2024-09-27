import { Context, Next } from "hono";

export async function generateSlug(c: Context, originalUrl: string) {
  const db = c.env.DB;
  const slug = generateHash();
  await c.env.LINKS.put(slug, originalUrl);
  c.executionCtx.waitUntil(
    db
      .prepare(`INSERT INTO analytics (slug, real, clicks) VALUES (?, ?, 0)`)
      .bind(slug, originalUrl)
      .run(),
  );
  return slug;
}

export async function generatePremiumSlug(
  c: Context,
  originalUrl: string,
  slug: string,
  update: boolean,
): Promise<boolean | {}> {
  if (!update) {
    const existingUrl = await getOriginalUrl(c, slug);
    if (existingUrl.length > 0) {
      return { error: "Short URL already in use" };
    }
  }
  await c.env.LINKS.put(slug, originalUrl);
  const db = c.env.DB;
  c.executionCtx.waitUntil(
    db
      .prepare(`INSERT INTO analytics (slug, real, clicks) VALUES (?, ?, 0)`)
      .bind(slug, originalUrl)
      .run(),
  );
  return true;
}

export async function getOriginalUrl(c: Context, slug: string) {
  console.log(slug);
  const originalUrl: string = (await c.env.LINKS.get(slug)) || "";
  return originalUrl;
}

export async function updateClick(c: Context, slug: string) {
  const db = c.env.DB;
  try {
    await db
      .prepare(`UPDATE analytics SET clicks = clicks + 1 WHERE slug = ?`)
      .bind(slug)
      .run();
  } catch (e) {
    console.log(`Error: ${e}`);
  }
}

export const protect = async (c: Context, next: Next) => {
  const token = c.env.TOKEN;
  if (c.req.header("Authorization") !== `Bearer ${token}`) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }
  await next();
};

export function isValidUrl(url: string) {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
}

function generateHash() {
  const characters =
    "23456789abcdefghijkmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

// Premium Middleware

type PremiumUrlHandler = (
  c: Context,
  originalUrl: string,
  shortUrl: string,
  isUpdate: boolean,
) => Promise<boolean | {}>;

export function premiumUrlMiddleware(
  handler: PremiumUrlHandler,
  isUpdate: boolean,
) {
  return async (c: Context, next: Next) => {
    const { originalUrl, shortUrl } = await c.req.json();

    if (!originalUrl || originalUrl === "") {
      return c.json({ error: "No URL provided" }, 400);
    }
    if (!isValidUrl(originalUrl)) {
      return c.json({ error: "Invalid URL" }, 400);
    }
    if (!shortUrl || shortUrl === "") {
      return c.json({ error: "No short URL provided" }, 400);
    }

    const success = await handler(c, originalUrl, shortUrl, isUpdate);

    if (!success) {
      return c.json(
        { error: `Some Error ${isUpdate ? "updating" : "creating"} rule` },
        409,
      );
    }

    return c.json({
      message: isUpdate ? "Premium Rule Updated" : "Premium Route Created",
      shortUrl,
    });
  };
}

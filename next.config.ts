// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Google（常見是 lh1~lh6，直接用萬用字元涵蓋）
      { protocol: "https", hostname: "**.googleusercontent.com" },
      // Facebook
      { protocol: "https", hostname: "graph.facebook.com" },
      { protocol: "https", hostname: "platform-lookaside.fbsbx.com" },
      // GitHub
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      // Discord
      { protocol: "https", hostname: "cdn.discordapp.com" },
      { protocol: "https", hostname: "media.discordapp.net" },
      // Gravatar
      { protocol: "https", hostname: "s.gravatar.com" },
      // X / Twitter
      { protocol: "https", hostname: "pbs.twimg.com" },
      // 你的其他來源也可加上來
      // { protocol: "https", hostname: "你的網域.com" },
    ],
  },
};

export default nextConfig;

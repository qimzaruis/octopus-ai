/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // รูปโลโก้ที่ admin อัปโหลดถูกเก็บใน Supabase Storage (URL ภายนอก)
    // next/image ต้องรู้จัก host ล่วงหน้า ไม่งั้นจะปฏิเสธการ render
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
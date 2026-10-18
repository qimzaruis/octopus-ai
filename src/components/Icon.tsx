import type { IconType } from "react-icons";
import type { CSSProperties } from "react";
import {
  FaArrowDown,
  FaArrowDown19,
  FaArrowLeft,
  FaArrowRight,
  FaArrowRightFromBracket,
  FaArrowTrendDown,
  FaArrowTrendUp,
  FaArrowUp,
  FaArrowUpRightFromSquare,
  FaBan,
  FaBars,
  FaBolt,
  FaCalendarDay,
  FaChartColumn,
  FaChartPie,
  FaChartSimple,
  FaCheck,
  FaChevronDown,
  FaChevronLeft,
  FaChevronRight,
  FaChevronUp,
  FaCircleCheck,
  FaCircleExclamation,
  FaCircleInfo,
  FaCircleNotch,
  FaCirclePause,
  FaCircleQuestion,
  FaCircleUser,
  FaCircleXmark,
  FaClock,
  FaClockRotateLeft,
  FaCoins,
  FaCode,
  FaCopy,
  FaCrown,
  FaCube,
  FaDisplay,
  FaDownload,
  FaEllipsis,
  FaEllipsisVertical,
  FaEye,
  FaEyeSlash,
  FaFile,
  FaFilter,
  FaFlask,
  FaFloppyDisk,
  FaFolderOpen,
  FaGaugeHigh,
  FaGear,
  FaGift,
  FaGlobe,
  FaGoogle,
  FaHourglassHalf,
  FaHouse,
  FaImage,
  FaImagePortrait,
  FaInfinity,
  FaKey,
  FaLayerGroup,
  FaLightbulb,
  FaListCheck,
  FaLock,
  FaMagnifyingGlass,
  FaMessage,
  FaMobileScreenButton,
  FaPaperPlane,
  FaPaperclip,
  FaPen,
  FaPhotoFilm,
  FaPlug,
  FaPlus,
  FaRankingStar,
  FaReceipt,
  FaRobot,
  FaRotate,
  FaRotateLeft,
  FaRoute,
  FaSatelliteDish,
  FaShareNodes,
  FaShieldHalved,
  FaSignal,
  FaSquare,
  FaSquarePen,
  FaStar,
  FaStop,
  FaTag,
  FaTerminal,
  FaTrash,
  FaTrashCan,
  FaTriangleExclamation,
  FaUpload,
  FaUser,
  FaUserAstronaut,
  FaUserShield,
  FaUserSlash,
  FaUsers,
  FaWallet,
  FaWandMagicSparkles,
  FaXmark,
} from "react-icons/fa6";

/**
 * แผนที่ไอคอนกลางของทั้งแอป — ใช้ react-icons (ชุด Font Awesome 6 Solid)
 *
 * ใช้ไอคอนแบบเติมสี (solid) ไม่ใช่ outline — react-icons เรนเดอร์เป็น SVG inline
 * จึงไม่ต้องโหลดฟอนต์ไอคอนและสเกลตาม font-size ได้เหมือนเดิม
 *
 * คีย์ยังเป็นชื่อแบบ Font Awesome (fa-xxx) เพื่อให้ข้อมูลสตริงเดิม (เมนู sidebar,
 * prop icon ของการ์ด) ใช้ต่อได้โดยไม่ต้องแก้
 */
const ICONS: Record<string, IconType> = {
  "fa-arrow-down": FaArrowDown,
  "fa-arrow-down-1-9": FaArrowDown19,
  "fa-arrow-left": FaArrowLeft,
  "fa-arrow-right": FaArrowRight,
  "fa-arrow-right-from-bracket": FaArrowRightFromBracket,
  "fa-arrow-trend-down": FaArrowTrendDown,
  "fa-arrow-trend-up": FaArrowTrendUp,
  "fa-arrow-up": FaArrowUp,
  "fa-arrow-up-right-from-square": FaArrowUpRightFromSquare,
  "fa-ban": FaBan,
  "fa-bars": FaBars,
  "fa-bolt": FaBolt,
  "fa-calendar-day": FaCalendarDay,
  "fa-chart-column": FaChartColumn,
  "fa-chart-pie": FaChartPie,
  "fa-chart-simple": FaChartSimple,
  "fa-check": FaCheck,
  "fa-chevron-down": FaChevronDown,
  "fa-chevron-left": FaChevronLeft,
  "fa-chevron-right": FaChevronRight,
  "fa-chevron-up": FaChevronUp,
  "fa-circle-check": FaCircleCheck,
  "fa-circle-exclamation": FaCircleExclamation,
  "fa-circle-info": FaCircleInfo,
  "fa-circle-notch": FaCircleNotch,
  "fa-circle-pause": FaCirclePause,
  "fa-circle-question": FaCircleQuestion,
  "fa-circle-user": FaCircleUser,
  "fa-circle-xmark": FaCircleXmark,
  "fa-clock": FaClock,
  "fa-clock-rotate-left": FaClockRotateLeft,
  "fa-coins": FaCoins,
  "fa-code": FaCode,
  "fa-copy": FaCopy,
  "fa-crown": FaCrown,
  "fa-cube": FaCube,
  "fa-display": FaDisplay,
  "fa-download": FaDownload,
  "fa-ellipsis": FaEllipsis,
  "fa-ellipsis-vertical": FaEllipsisVertical,
  "fa-eye": FaEye,
  "fa-eye-slash": FaEyeSlash,
  "fa-file": FaFile,
  "fa-filter": FaFilter,
  "fa-flask": FaFlask,
  "fa-floppy-disk": FaFloppyDisk,
  "fa-folder-open": FaFolderOpen,
  "fa-gauge-high": FaGaugeHigh,
  "fa-gear": FaGear,
  "fa-gift": FaGift,
  "fa-globe": FaGlobe,
  "fa-google": FaGoogle,
  "fa-hourglass-half": FaHourglassHalf,
  "fa-house": FaHouse,
  "fa-image": FaImage,
  "fa-image-portrait": FaImagePortrait,
  "fa-infinity": FaInfinity,
  "fa-key": FaKey,
  "fa-layer-group": FaLayerGroup,
  "fa-lightbulb": FaLightbulb,
  "fa-list-check": FaListCheck,
  "fa-lock": FaLock,
  "fa-magnifying-glass": FaMagnifyingGlass,
  "fa-message": FaMessage,
  "fa-mobile-screen-button": FaMobileScreenButton,
  "fa-paper-plane": FaPaperPlane,
  "fa-paperclip": FaPaperclip,
  "fa-pen": FaPen,
  "fa-photo-film": FaPhotoFilm,
  "fa-plug": FaPlug,
  "fa-plus": FaPlus,
  "fa-ranking-star": FaRankingStar,
  "fa-receipt": FaReceipt,
  "fa-robot": FaRobot,
  "fa-rotate": FaRotate,
  "fa-rotate-left": FaRotateLeft,
  "fa-route": FaRoute,
  "fa-satellite-dish": FaSatelliteDish,
  "fa-share-nodes": FaShareNodes,
  "fa-shield-halved": FaShieldHalved,
  "fa-signal": FaSignal,
  "fa-square": FaSquare,
  "fa-square-pen": FaSquarePen,
  "fa-star": FaStar,
  "fa-stop": FaStop,
  "fa-tag": FaTag,
  "fa-terminal": FaTerminal,
  "fa-trash": FaTrash,
  "fa-trash-can": FaTrashCan,
  "fa-triangle-exclamation": FaTriangleExclamation,
  "fa-upload": FaUpload,
  "fa-user": FaUser,
  "fa-user-astronaut": FaUserAstronaut,
  "fa-user-shield": FaUserShield,
  "fa-user-slash": FaUserSlash,
  "fa-users": FaUsers,
  "fa-wallet": FaWallet,
  "fa-wand-magic-sparkles": FaWandMagicSparkles,
  "fa-xmark": FaXmark,
};

const STYLE_TOKENS = new Set(["fa-solid", "fa-regular", "fa-brands", "fas", "far", "fab"]);

/** แปลงชื่อไอคอนที่รับมา (fa-solid fa-cube / fa-cube / cube) ให้เป็นคีย์ในแผนที่ */
function toKey(name: string): string {
  const tokens = name.trim().split(/\s+/).filter(Boolean);
  const explicit = tokens.find((t) => t.startsWith("fa-") && !STYLE_TOKENS.has(t));
  if (explicit) return explicit;
  const bare = tokens.find((t) => !STYLE_TOKENS.has(t));
  return bare ? `fa-${bare.replace(/^fa-/, "")}` : "";
}

export type IconProps = {
  /** ชื่อไอคอน — รับได้ทั้ง "fa-solid fa-cube", "fa-cube" หรือ "cube" */
  name: string;
  className?: string;
  /** ขนาด (ค่าเริ่มต้น 1em = สเกลตาม font-size ของข้อความรอบข้าง) */
  size?: string | number;
  color?: string;
  title?: string;
  style?: CSSProperties;
};

/**
 * Icon — ใช้แทน <i className="fa-solid ..." /> ทั้งโปรเจกต์
 *
 * size เริ่มต้นเป็น "1em" ให้ไอคอนสเกลตาม font-size เหมือนพฤติกรรมเดิมของ
 * Font Awesome จึงยังใช้คลาสอย่าง text-micro / text-caption ได้ตามเดิม
 *
 * สําคัญ: บังคับ display = inline-block ด้วย inline style เพราะ Tailwind Preflight
 * ตั้ง `svg { display: block }` ไว้ ถ้าไม่ทับ ไอคอนจะตกไปอยู่บรรทัดใหม่แทนที่จะ
 * เรียงข้างข้อความ (พฤติกรรมเดียวกับ <i> ของ Font Awesome เดิม)
 */
export default function Icon({ name, className, size = "1em", color, title, style }: IconProps) {
  const Cmp = ICONS[toKey(name)] ?? FaCircleQuestion;
  return (
    <Cmp
      className={className}
      size={size}
      color={color}
      title={title}
      style={{ display: "inline-block", verticalAlign: "-0.125em", ...style }}
    />
  );
}
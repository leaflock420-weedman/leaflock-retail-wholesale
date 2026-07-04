/**
 * Product images matched to leaflock.com.au CDN (same visuals as consumer store).
 * width=400 keeps portal loads fast.
 */
const CDN = "https://www.leaflock.com.au/cdn/shop/files";

const PRODUCT_IMAGES = {
  "HP-SINGLE": `${CDN}/7da755cb-09e6d7_4a92cc8537134a90938828698e80dea4_mv2.png?v=1780013371&width=400`,
  "HP-3PACK": `${CDN}/Untitled_design_-_2025-11-11T233208.411.png?v=1780013371&width=400`,
  "GUM-90-STR": `${CDN}/LeafLock_Gummy_Mix_Strawberry.png?v=1780023389&width=800`,
  "GUM-90-GRA": `${CDN}/LeafLock_Gummy_Grape.png?v=1780023386&width=800`,
  "GUM-90-BLU": `${CDN}/LeafLockGummyMixPouchMockup_5.png?v=1780014860&width=800`,
  "GUM-90-DIY": `${CDN}/LeafLockGummyMix1.png?v=1780014860&width=800`,
  "GUM-90-BUN": `${CDN}/LeafLockGummyMix1.png?v=1780014860&width=800`,
  "AF-FORB": `${CDN}/Untitled_design_-_2025-11-11T233208.411.png?v=1780013371&width=400`,
  "AF-BLUE": `${CDN}/LeafLockGummyMixPouchMockup_5.png?v=1780014860&width=400`,
  "WW-30-BLUE": `${CDN}/LeafLockGummyMixPouchMockup_5.png?v=1780014860&width=400`,
  "WW-30-RAIN": `${CDN}/LeafLockGummyMixPouchMockup_5.png?v=1780014860&width=400`,
  "WW-30-ORAN": `${CDN}/LeafLockGummyMixPouchMockup_5.png?v=1780014860&width=400`,
  "WW-30-BISC": `${CDN}/BiscottiWaxWizard.png?v=1780020989&width=600`,
  "WW-30-LIME": `${CDN}/BiscottiWaxWizard.png?v=1780020989&width=600`,
  "WW-30-PLAIN": `${CDN}/BiscottiWaxWizard.png?v=1780020989&width=600`,
  "WW-10-ORAN": `${CDN}/BiscottiWaxWizard.png?v=1780020989&width=400`,
  "WW-10-BLUE": `${CDN}/BiscottiWaxWizard.png?v=1780020989&width=400`,
  "WW-10-FORB": `${CDN}/BiscottiWaxWizard.png?v=1780020989&width=400`,
  "WW-10-BISC": `${CDN}/BiscottiWaxWizard.png?v=1780020989&width=400`,
  "WW-10-LIME": `${CDN}/BiscottiWaxWizard.png?v=1780020989&width=400`,
  "WW-10-PLAIN": `${CDN}/BiscottiWaxWizard.png?v=1780020989&width=400`,
  "WW-100-PLAIN": `${CDN}/BiscottiWaxWizard.png?v=1780020989&width=400`,
  BW: `${CDN}/Untitled_design_-_2025-11-11T171334.195.png?v=1762845311&width=600`,
  "MT-15M": `${CDN}/Untitled_design_-_2025-11-11T171334.195.png?v=1762845311&width=600`,
  "BB-20": `${CDN}/Untitled_design_-_2025-11-11T171334.195.png?v=1762845311&width=600`,
  "CB-1LB": `${CDN}/1LBCuringBag.png?v=1780020577&width=600`,
  "CHOP-PURP": `${CDN}/Untitled_design_-_2025-11-11T233208.411.png?v=1780013371&width=400`,
  "CHOP-RAIN": `${CDN}/Untitled_design_-_2025-11-11T233208.411.png?v=1780013371&width=400`,
  "CHOP-FORB": `${CDN}/Untitled_design_-_2025-11-11T233208.411.png?v=1780013371&width=400`,
  "CHOP-BLUE": `${CDN}/Untitled_design_-_2025-11-11T233208.411.png?v=1780013371&width=400`,
  "CHOP-ORAN": `${CDN}/Untitled_design_-_2025-11-11T233208.411.png?v=1780013371&width=400`,
  CUSHION: "assets/demo/leaflock-snapback-cap.png",
  SNAPBACK: "assets/demo/leaflock-snapback-cap.png",
  "KEYCHAINS-TEXT": `${CDN}/rn-image_picker_lib_temp_ab5c8337-1711-486b-98a2-a9f248fa8595.png?v=1783050188&width=400`,
  "KEYCHAINS-MONO": `${CDN}/rn-image_picker_lib_temp_ab5c8337-1711-486b-98a2-a9f248fa8595.png?v=1783050188&width=400`,
  STICKERS: `${CDN}/rn-image_picker_lib_temp_236fb191-5329-46d8-8016-84af936660fe.png?v=1783051940&width=400`,
  MAGNETS: `${CDN}/rn-image_picker_lib_temp_150f580a-94e8-4d61-9457-cd38785f5596.png?v=1783051267&width=400`,
  "PEND-18K-200": `${CDN}/LeaflockNecklace.jpg?v=1779965114&width=400`,
  "PEND-BUNDLE-10": `${CDN}/LeaflockNecklace.jpg?v=1779965114&width=400`,
};

const CATEGORY_FALLBACK = {
  airFresheners: `${CDN}/Untitled_design_-_2025-11-11T233208.411.png?v=1780013371&width=400`,
  gummyMix: `${CDN}/LeafLockGummyMix1.png?v=1780014860&width=400`,
  waxWizard30: `${CDN}/BiscottiWaxWizard.png?v=1780020989&width=400`,
  waxWizard10: `${CDN}/BiscottiWaxWizard.png?v=1780020989&width=400`,
  waxWizard100: `${CDN}/BiscottiWaxWizard.png?v=1780020989&width=400`,
  growTools: `${CDN}/Untitled_design_-_2025-11-11T171334.195.png?v=1762845311&width=400`,
  curingBags: `${CDN}/1LBCuringBag.png?v=1780020577&width=400`,
  chopMats: `${CDN}/Untitled_design_-_2025-11-11T233208.411.png?v=1780013371&width=400`,
  merch: "assets/demo/leaflock-snapback-cap.png",
  incoming: `${CDN}/LeaflockNecklace.jpg?v=1779965114&width=400`,
  humidity: `${CDN}/7da755cb-09e6d7_4a92cc8537134a90938828698e80dea4_mv2.png?v=1780013371&width=400`,
};

function imageForSku(sku, categoryId) {
  return PRODUCT_IMAGES[sku] || CATEGORY_FALLBACK[categoryId] || "assets/demo/leaflock-curing-bag.png";
}

function marginStats(wholesale, rrp, unitBasis) {
  const unitWholesale = unitBasis && unitBasis > 0 ? wholesale / unitBasis : wholesale;
  const profit = Math.round((rrp - unitWholesale) * 100) / 100;
  const pct = rrp > 0 ? Math.round((profit / rrp) * 1000) / 10 : 0;
  return { profit, pct };
}

module.exports = { PRODUCT_IMAGES, CATEGORY_FALLBACK, imageForSku, marginStats };
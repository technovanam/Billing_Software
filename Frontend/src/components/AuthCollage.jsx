const IMAGES = [
  "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&h=500&fit=crop",
  "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=400&h=350&fit=crop",
  "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&h=500&fit=crop",
  "https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=400&h=350&fit=crop",
  "https://images.unsplash.com/photo-1562564055-71e051d33c19?w=400&h=350&fit=crop",
  "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400&h=500&fit=crop",
  "https://images.unsplash.com/photo-1633158829585-23ba8f7c8caf?w=400&h=350&fit=crop",
  "https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=400&h=500&fit=crop",
];

export default function AuthCollage() {
  return (
    <div className="hidden lg:block lg:w-[55%] sticky top-0 h-screen relative bg-gray-100 overflow-hidden p-3 flex-shrink-0">
      {/* Glass finish overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-br from-white/40 via-white/15 to-white/35 backdrop-blur-[1px]" />
      <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-t from-white/30 via-transparent to-white/20" />
      <div className="absolute top-0 left-0 right-0 h-1/3 z-10 pointer-events-none bg-gradient-to-b from-white/50 to-transparent" />
      <div className="grid grid-cols-4 grid-rows-6 gap-2 h-full">
        <div className="col-span-1 row-span-3 relative rounded-2xl overflow-hidden">
          <img src={IMAGES[0]} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="col-span-1 row-span-2 relative z-20 rounded-2xl overflow-hidden bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 p-5 flex flex-col justify-end shadow-lg">
          <span className="text-white text-4xl font-bold leading-none mb-2 drop-shadow-sm">85%</span>
          <p className="text-white/95 text-xs leading-snug drop-shadow-sm">of businesses say billing automation saves them 10+ hours per month.</p>
        </div>
        <div className="col-span-1 row-span-3 relative rounded-2xl overflow-hidden">
          <img src={IMAGES[2]} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="col-span-1 row-span-2 relative rounded-2xl overflow-hidden">
          <img src={IMAGES[3]} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="col-span-1 row-span-1 relative rounded-2xl overflow-hidden">
          <img src={IMAGES[1]} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="col-span-1 row-span-1 relative rounded-2xl overflow-hidden">
          <img src={IMAGES[4]} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="col-span-1 row-span-3 relative rounded-2xl overflow-hidden">
          <img src={IMAGES[5]} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="col-span-2 row-span-2 relative z-20 rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 p-6 flex flex-col justify-end shadow-lg">
          <span className="text-white text-5xl font-bold leading-none mb-2 drop-shadow-sm">76%</span>
          <p className="text-white/95 text-sm leading-snug drop-shadow-sm">of small businesses say timely invoicing improved their cash flow and reduced payment delays.</p>
        </div>
        <div className="col-span-1 row-span-3 relative rounded-2xl overflow-hidden">
          <img src={IMAGES[7]} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="col-span-1 row-span-1 relative rounded-2xl overflow-hidden">
          <img src={IMAGES[6]} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="col-span-1 row-span-1 relative rounded-2xl overflow-hidden">
          <img src={IMAGES[4]} alt="" className="w-full h-full object-cover" />
        </div>
      </div>
    </div>
  );
}

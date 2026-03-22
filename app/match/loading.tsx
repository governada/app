export default function MatchLoading() {
  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      <div className="animate-pulse text-white/30 text-sm">Entering the room...</div>
    </div>
  );
}

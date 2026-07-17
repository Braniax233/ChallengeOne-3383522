export default function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {Icon && (
        <div className="w-12 h-12 rounded-2xl bg-ink-100 flex items-center justify-center mb-3">
          <Icon size={22} className="text-ink-400" />
        </div>
      )}
      <p className="text-sm font-semibold text-ink-700">{title}</p>
      {description && (
        <p className="text-xs text-ink-400 mt-1 max-w-xs">{description}</p>
      )}
    </div>
  );
}

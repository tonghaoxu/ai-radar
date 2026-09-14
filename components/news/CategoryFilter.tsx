const CATEGORIES = [
  '全部',
  '大模型',
  '产品发布',
  '投融资',
  '政策监管',
  '学术研究',
  '算力芯片',
  '开源生态',
  'AI技术',
  'AI综合',
];

interface CategoryFilterProps {
  selected: string;
  onSelect: (category: string) => void;
}

export function CategoryFilter({ selected, onSelect }: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CATEGORIES.map((cat) => (
        <button
          key={cat}
          onClick={() => onSelect(cat)}
          className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
            selected === cat
              ? 'bg-primary text-primary-foreground font-medium'
              : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground'
          }`}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}

export { CATEGORIES };

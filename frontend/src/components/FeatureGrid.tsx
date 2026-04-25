import type { LucideIcon } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

type FeatureItem = {
  icon: LucideIcon;
  title: string;
  description: string;
};

type FeatureGridProps = {
  title: string;
  subtitle: string;
  items: FeatureItem[];
};

export default function FeatureGrid({ title, subtitle, items }: FeatureGridProps) {
  return (
    <section className="page-section" aria-labelledby={`${title}-heading`}>
      <header className="section-header">
        <h2 id={`${title}-heading`}>{title}</h2>
        <p>{subtitle}</p>
      </header>
      <div className="feature-grid">
        {items.map((item) => (
          <Card key={item.title}>
            <CardHeader>
              <div className="icon-wrap" aria-hidden="true">
                <item.icon size={18} />
              </div>
              <CardTitle>{item.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>{item.description}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

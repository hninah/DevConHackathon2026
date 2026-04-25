import { Link } from 'react-router-dom';
import { Languages, MapPinned, MessageSquareQuote } from 'lucide-react';

import FeatureGrid from '../components/FeatureGrid';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { textTutorHighlights } from '../lib/siteContent';

export default function TextTutorPage() {
  return (
    <div className="page-stack">
      <section className="page-intro">
        <h1>Text Tutor</h1>
        <p>
          Ask in a familiar language, answer in simplified English, and cite the Alberta manual by
          page so students can trust and review every response.
        </p>
      </section>

      <FeatureGrid
        title="Tutor Flow"
        subtitle="Designed for translation confidence, citation transparency, and map-based support."
        items={textTutorHighlights}
      />

      <section className="feature-grid split">
        <Card>
          <CardHeader>
            <div className="icon-wrap" aria-hidden="true">
              <Languages size={18} />
            </div>
            <CardTitle>Prompt Behavior</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Keep legal terms in English but explain in plain language. Preserve source meaning and
              safety constraints.
            </CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="icon-wrap" aria-hidden="true">
              <MapPinned size={18} />
            </div>
            <CardTitle>Map-Aware Guidance</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Learners confirm their home location via map context instead of a public search box,
              reducing interface complexity.
            </CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="icon-wrap" aria-hidden="true">
              <MessageSquareQuote size={18} />
            </div>
            <CardTitle>Deep Link Modal</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Open a deep-link modal to inspect how citations and priority scoring are explained.
            </CardDescription>
            <Button asChild variant="secondary" size="sm">
              <Link to="/text-tutor?modal=design-rules">Open details modal</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

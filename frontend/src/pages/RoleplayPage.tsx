import { Link } from 'react-router-dom';
import { BadgeAlert, BotMessageSquare, ShieldCheck } from 'lucide-react';

import FeatureGrid from '../components/FeatureGrid';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { roleplayHighlights } from '../lib/siteContent';

export default function RoleplayPage() {
  return (
    <div className="page-stack">
      <section className="page-intro">
        <h1>Roleplay Scenario Lab</h1>
        <p>
          Learners practice passive and active scenarios using visual prompts and multi-part
          multiple-choice decisions.
        </p>
      </section>

      <FeatureGrid
        title="Scenario-Based Learning"
        subtitle="Single-player mode where AI generates scene images and corrective guidance."
        items={roleplayHighlights}
      />

      <section className="feature-grid split">
        <Card>
          <CardHeader>
            <div className="icon-wrap" aria-hidden="true">
              <BadgeAlert size={18} />
            </div>
            <CardTitle>Passive Mode</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              User acts as thief, AI acts as police, and the system explains the legal boundaries
              after each wrong choice.
            </CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="icon-wrap" aria-hidden="true">
              <ShieldCheck size={18} />
            </div>
            <CardTitle>Active Mode</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              User acts as police and answers ordered, multi-step questions to reinforce proper
              action sequence.
            </CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="icon-wrap" aria-hidden="true">
              <BotMessageSquare size={18} />
            </div>
            <CardTitle>Scenario Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              End screen highlights weak modules and gives a prioritized review to-do list with
              citations.
            </CardDescription>
            <Button asChild variant="secondary" size="sm">
              <Link to="/roleplay?modal=roleplay-summary">Open summary modal</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

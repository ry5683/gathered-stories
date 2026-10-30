// WHAT: Lists the user's weddings, current workflow status, and lightweight inquiry counts.
// WHY: Returning users can resume work without entering a dashboard or navigating a calendar.
"use client";

import type { WeddingSummary } from "@/lib/types";

type Props = {
  weddings: WeddingSummary[];
  weeklyInquiries: number;
  integrationsEnabled: boolean;
  onResume: (wedding: WeddingSummary) => void;
  onNew: () => void;
  onInquiry: (postRecordId: string) => void;
  onMarkPublished: (postRecordId: string) => void;
};

export function WeddingList({ weddings, weeklyInquiries, integrationsEnabled, onResume, onNew, onInquiry, onMarkPublished }: Props) {
  return (
    <section className="panel wedding-list-panel" aria-labelledby="wedding-list-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Your stories</p>
          <h2 id="wedding-list-title">Pick up where you left off</h2>
        </div>
        <button className="button button-primary" type="button" onClick={onNew}>New wedding</button>
      </div>
      <p className="muted-copy weekly-summary">This week: {weeklyInquiries} {weeklyInquiries === 1 ? "inquiry" : "inquiries"} from your posts.</p>
      {weddings.length === 0 ? (
        <p className="muted-copy">Your saved weddings will appear here.</p>
      ) : (
        <ul className="wedding-list">
          {weddings.map((item) => (
            <li className="wedding-list-item" key={item.wedding.id}>
              <div className="wedding-list-copy">
                <h3>{item.wedding.venue}</h3>
                <p>{item.wedding.city}{item.wedding.weddingDate ? ` · ${item.wedding.weddingDate}` : ""}</p>
                <span className={`status-pill status-${item.status.toLowerCase()}`}>{item.status}</span>
                {item.wordpressDraftUrl && (
                  <p className="muted-copy">
                    {item.isPublished ? "Marked as published in WordPress." : "Sent to WordPress as a draft. Publish it there before marking it live."}
                    {" "}<a href={item.wordpressDraftUrl} target="_blank" rel="noreferrer">{item.isPublished ? "Open WordPress post" : "Open WordPress draft"}</a>
                  </p>
                )}
                {item.isPublished && <p className="muted-copy">{item.inquiryCount} {item.inquiryCount === 1 ? "inquiry" : "inquiries"} recorded.</p>}
              </div>
              <div className="wedding-list-actions">
                <button className="button button-secondary" type="button" onClick={() => onResume(item)}>Resume</button>
                {integrationsEnabled && item.wordpressPostRecordId && !item.isPublished && (
                  <button className="button button-secondary" type="button" onClick={() => onMarkPublished(item.wordpressPostRecordId!)}>I published this</button>
                )}
                {integrationsEnabled && item.wordpressPostRecordId && item.isPublished && (
                  <button className="button button-secondary" type="button" onClick={() => onInquiry(item.wordpressPostRecordId!)}>Inquiry from this post</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {!integrationsEnabled && <p className="status-message">WordPress delivery needs server-side Supabase integration credentials; copy-all remains available.</p>}
    </section>
  );
}

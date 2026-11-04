// WHAT: Lists the user's weddings, current workflow status, and lightweight inquiry counts.
// WHY: Returning users can resume work without entering a dashboard or navigating a calendar.
"use client";

import type { WeddingSummary } from "@/lib/types";

const STATUS_LABELS: Record<WeddingSummary["status"], string> = {
  Draft: "In progress",
  Approved: "Ready to post",
  Sent: "On your blog",
};

type Props = {
  weddings: WeddingSummary[];
  weeklyInquiries: number;
  integrationsEnabled: boolean;
  onResume: (wedding: WeddingSummary) => void;
  onNew: () => void;
  onOpenVendors: () => void;
  onInquiry: (postRecordId: string) => void;
  onMarkPublished: (postRecordId: string) => void;
};

export function WeddingList({ weddings, weeklyInquiries, integrationsEnabled, onResume, onNew, onOpenVendors, onInquiry, onMarkPublished }: Props) {
  return (
    <section className="panel wedding-list-panel" aria-labelledby="wedding-list-title">
      <div className="panel-heading">
        <div>
          <h2 id="wedding-list-title">My weddings</h2>
        </div>
        <div className="inline-actions">
          <button className="button button-secondary" type="button" onClick={onOpenVendors}>My vendors</button>
          <button className="button button-primary" type="button" onClick={onNew}>New wedding</button>
        </div>
      </div>
      {weeklyInquiries > 0 && <p className="muted-copy weekly-summary">This week: {weeklyInquiries} {weeklyInquiries === 1 ? "inquiry" : "inquiries"} from your posts.</p>}
      {weddings.length === 0 ? (
        <p className="muted-copy">No weddings yet. Tap &ldquo;New wedding&rdquo; to start.</p>
      ) : (
        <ul className="wedding-list">
          {weddings.map((item) => (
            <li className="wedding-list-item" key={item.wedding.id}>
              <div className="wedding-list-copy">
                <h3>{item.wedding.venue}</h3>
                <p>{item.wedding.city}{item.wedding.weddingDate ? ` · ${item.wedding.weddingDate}` : ""}</p>
                <span className={`status-pill status-${item.status.toLowerCase()}`}>{STATUS_LABELS[item.status]}</span>
                {item.vendorCount > 0 && item.status !== "Draft" && (
                  <span className={`status-pill vendor-sent-pill ${item.vendorsSentCount === item.vendorCount ? "status-approved" : ""}`}>Vendors sent {item.vendorsSentCount} of {item.vendorCount}</span>
                )}
                {item.wordpressDraftUrl && (
                  <p className="muted-copy">
                    {item.isPublished ? "Live on your blog." : "On your blog as a draft. Publish it in WordPress, then tap \"I published this\"."}
                    {" "}<a href={item.wordpressDraftUrl} target="_blank" rel="noreferrer">Open in WordPress</a>
                  </p>
                )}
                {item.isPublished && <p className="muted-copy">{item.inquiryCount} {item.inquiryCount === 1 ? "inquiry" : "inquiries"} recorded.</p>}
              </div>
              <div className="wedding-list-actions">
                <button className="button button-secondary" type="button" onClick={() => onResume(item)}>Open</button>
                {integrationsEnabled && item.wordpressPostRecordId && !item.isPublished && (
                  <button className="button button-secondary" type="button" onClick={() => onMarkPublished(item.wordpressPostRecordId!)}>I published this</button>
                )}
                {integrationsEnabled && item.wordpressPostRecordId && item.isPublished && (
                  <button className="button button-secondary" type="button" onClick={() => onInquiry(item.wordpressPostRecordId!)}>A couple inquired from this post</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

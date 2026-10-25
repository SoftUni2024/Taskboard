export const DEFAULT_STAGES = ['Not Started', 'In Progress', 'Done'];

function tasks(stage, entries) {
  return entries.map(([title, description]) => ({ title, description, stage }));
}

export const SAMPLE_PROJECTS = [
  {
    title: 'Company Website Redesign',
    description: 'Refresh the company website with clearer navigation, accessible pages, and a faster mobile experience.',
    owner: 'steve@gmail.com',
    tasks: [
      ...tasks(2, [
        ['Audit the existing website', 'Review the current pages and document confusing navigation, outdated content, and broken links.'],
        ['Interview key stakeholders', 'Collect goals and priorities from marketing, sales, and customer support.'],
        ['Define the new sitemap', 'List the core pages and agree on the primary navigation structure.'],
        ['Create a visual moodboard', 'Gather typography, color, and layout references for the new direction.'],
      ]),
      ...tasks(1, [
        ['Design the homepage', '<p>Create desktop and mobile mockups for the homepage.</p><ul><li>Clear headline</li><li>Primary call to action</li><li>Customer proof</li></ul>'],
        ['Build reusable page components', 'Implement shared header, footer, buttons, and content sections.'],
        ['Rewrite service descriptions', 'Replace technical copy with concise descriptions of customer benefits.'],
        ['Prepare optimized images', 'Export responsive images with appropriate sizes and descriptive alternative text.'],
      ]),
      ...tasks(0, [
        ['Implement the contact page', 'Add accessible contact details and validate the contact form.'],
        ['Run accessibility checks', 'Test keyboard navigation, focus visibility, contrast, and field labels.'],
        ['Test the mobile layouts', 'Check the main pages at phone and tablet widths.'],
        ['Publish the redesigned website', 'Complete the launch checklist and verify the production pages.'],
      ]),
    ],
  },
  {
    title: 'Mobile App MVP',
    description: 'Deliver a small mobile app that helps people plan their day and track meaningful progress.',
    owner: 'maria@gmail.com',
    tasks: [
      ...tasks(2, [
        ['Define the MVP scope', 'Choose the essential user journeys and postpone nonessential features.'],
        ['Sketch the core screens', 'Draft the welcome screen, daily plan, task details, and profile.'],
        ['Create the design tokens', 'Define reusable colors, spacing, and typography for the app.'],
      ]),
      ...tasks(1, [
        ['Build the onboarding flow', 'Explain the app in a few short steps and let returning users skip onboarding.'],
        ['Implement the daily task list', 'Show the current plan and allow tasks to be marked complete.'],
        ['Connect account authentication', 'Implement sign-in, sign-out, and protected account screens.'],
        ['Add task detail editing', 'Allow users to edit the title and description without losing their changes.'],
      ]),
      ...tasks(0, [
        ['Add offline error states', 'Explain connection failures and provide a clear retry action.'],
        ['Test on Android devices', 'Check layout, text input, and navigation on representative screen sizes.'],
        ['Test on iOS devices', 'Verify safe areas, scrolling, and keyboard behavior.'],
        ['Prepare the beta release', 'Write release notes and assemble a short feedback questionnaire.'],
      ]),
    ],
  },
  {
    title: 'Autumn Marketing Campaign',
    description: 'Plan and launch an autumn campaign with coordinated landing-page, email, and social content.',
    owner: 'peter@gmail.com',
    tasks: [
      ...tasks(2, [
        ['Define the target audience', 'Identify the main customer segment and document its needs.'],
        ['Set campaign goals', 'Choose measurable goals for qualified leads and landing-page conversions.'],
        ['Review previous campaign results', 'Identify which messages and channels performed well in earlier campaigns.'],
      ]),
      ...tasks(1, [
        ['Write the campaign messaging', 'Create a consistent headline, supporting message, and call to action.'],
        ['Design social media creatives', 'Prepare image variants for the chosen social channels.'],
        ['Build the campaign landing page', 'Develop a responsive page with a clear offer and concise signup form.'],
      ]),
      ...tasks(0, [
        ['Draft the email sequence', 'Prepare launch, reminder, and final follow-up drafts for review.'],
        ['Set up conversion tracking', 'Verify campaign parameters and form completion events.'],
        ['Schedule approved content', 'Create the publishing calendar after copy and creative approval.'],
        ['Prepare the results report', 'Define the report template and the metrics to review after launch.'],
      ]),
    ],
  },
  {
    title: 'Home Office Setup',
    description: 'Create a comfortable, organized home workspace for focused work and clear video calls.',
    owner: 'steve@gmail.com',
    tasks: [
      ...tasks(2, [
        ['Measure the available room', 'Record desk dimensions, window positions, and power outlet locations.'],
        ['Set a workspace budget', 'Allocate a budget for furniture, lighting, and essential accessories.'],
        ['Choose the desk position', 'Select a position with comfortable lighting and a tidy call background.'],
      ]),
      ...tasks(1, [
        ['Compare ergonomic chairs', 'Compare adjustable options and note comfort and warranty details.'],
        ['Plan the monitor layout', 'Decide on monitor height, viewing distance, and laptop placement.'],
        ['Organize desk storage', 'Sort daily essentials and choose a place for documents and stationery.'],
        ['Improve task lighting', 'Try a desk lamp position that reduces glare and shadows.'],
      ]),
      ...tasks(0, [
        ['Route and label cables', 'Secure cables and label power adapters for easy maintenance.'],
        ['Test the video call setup', 'Check camera framing, microphone quality, and background lighting.'],
        ['Create a weekly tidy-up checklist', 'Define a short routine for cleaning the desk and clearing unused items.'],
        ['Review workspace comfort', 'Use the workspace for a week and record any adjustments needed.'],
      ]),
    ],
  },
];

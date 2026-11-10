import { publicText, type PublicLanguage } from './public-i18n';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, ChevronLeft, ChevronRight, Maximize2, Palette, SlidersHorizontal, X } from 'lucide-react';

type Variant = { name: string; price: string; inviteOnly?: boolean };
type Model = {
  id: string; name: string; subtitle: string; variants: Variant[]; lease?: string;
  priceNote: string; gallery: string[]; range: string; performance: string;
  drivetrain: string; features: string[]; colors: string[]; wheels: string[];
};

const models: Model[] = [
  { id: 'model-3', name: 'Model 3', subtitle: 'Electric sedan', variants: [
    { name: 'Model 3', price: '$36,990' }, { name: 'Model 3 Premium', price: '$42,490' }, { name: 'Model 3 Performance', price: '$54,990' }
  ], lease: 'From $540 / month', priceNote: 'Starting prices supplied by Tesla Markets management; final quotation and availability are confirmed individually.',
    gallery: Array.from({ length: 5 }, (_, i) => '/resources/model-3-' + (i + 1) + '.jpg'), range: 'Varies by trim and model year', performance: 'Varies by trim', drivetrain: 'Rear-wheel or all-wheel drive, depending on trim',
    features: ['Five-seat electric sedan', 'Glass roof and minimalist cabin', 'Driver assistance options', 'Configuration and delivery subject to confirmation'],
    colors: ['Pearl White', 'Solid Black', 'Stealth Grey', 'Quicksilver', 'Ultra Red', 'Deep Blue'], wheels: ['18-inch Photon', '19-inch Nova'] },
  { id: 'model-y', name: 'Model Y', subtitle: 'Electric SUV', variants: [
    { name: 'Model Y', price: '$39,990' }, { name: 'Model Y Premium', price: '$45,990' }, { name: 'Model YL Premium', price: '$61,990' }, { name: 'Model Y Performance', price: '$57,990' }
  ], lease: 'From $799 / month', priceNote: 'Starting prices supplied by Tesla Markets management; final quotation and availability are confirmed individually.',
    gallery: Array.from({ length: 5 }, (_, i) => '/resources/model-y-' + (i + 1) + '.jpg'), range: 'Varies by trim and model year', performance: 'Varies by trim', drivetrain: 'Rear-wheel or all-wheel drive, depending on trim',
    features: ['Versatile electric SUV layout', 'Flexible passenger and cargo space', 'Driver assistance options', 'Configuration and delivery subject to confirmation'],
    colors: ['Pearl White', 'Solid Black', 'Stealth Grey', 'Quicksilver', 'Ultra Red', 'Deep Blue'], wheels: ['19-inch Gemini', '20-inch Induction'] },
  { id: 'cybertruck', name: 'Cybertruck', subtitle: 'All-electric utility vehicle', variants: [
    { name: 'Cybertruck', price: '$82,490' }, { name: 'Cybertruck Premium', price: '$92,490' }, { name: 'Cyberbeast', price: '$102,490' }
  ], lease: 'From $1,450 / month', priceNote: 'Starting prices supplied by Tesla Markets management; trim, market availability and final quotation require confirmation.',
    gallery: Array.from({ length: 9 }, (_, i) => '/resources/cybertruck-' + (i + 1) + '.jpg'), range: 'Varies by configuration', performance: 'Varies by configuration', drivetrain: 'Electric all-wheel drive on applicable versions',
    features: ['Stainless-steel exoskeleton design', 'Utility-focused storage and load area', 'Adaptive air suspension on selected versions', 'Final specification must be confirmed'],
    colors: ['Stainless Steel', 'Matte Black preference', 'Arctic White preference'], wheels: ['20-inch Core', 'Cyber Wheel'] },
  { id: 'roadster', name: 'Roadster', subtitle: 'Next-generation electric sports car', variants: [
    { name: 'Roadster Performance', price: '$45,000' }, { name: 'Roadster Thrust', price: '$245,000' }, { name: 'Roadster Limited', price: 'Price to be specified' }, { name: 'Roadster Rocket', price: 'Invite only', inviteOnly: true }
  ], priceNote: 'Roadster variant labels and prices supplied by Tesla Markets management. Confirm specification and availability with management.',
    gallery: Array.from({ length: 6 }, (_, i) => '/resources/roadster-' + (i + 1) + '.jpg'), range: 'Final production specification to be confirmed', performance: 'Variant-dependent', drivetrain: 'Final production specification to be confirmed',
    features: ['Next-generation electric sports car collection', 'Variant-specific enquiries handled by management', 'Specifications and delivery timing require confirmation'],
    colors: ['Pearl White preference', 'Solid Black preference', 'Ultra Red preference', 'Deep Blue preference'], wheels: ['Performance wheel preference', 'Aero wheel preference'] },
  { id: 'semi', name: 'Tesla Semi', subtitle: 'All-electric heavy-duty truck', variants: [{ name: 'Tesla Semi', price: '$260,000' }],
    priceNote: 'Catalogue price supplied by Tesla Markets management; final quotation and availability must be confirmed.',
    gallery: Array.from({ length: 10 }, (_, i) => '/resources/semi-' + (i + 1) + '.jpg'), range: 'Depends on configuration and operating conditions', performance: 'Heavy-duty electric truck; final specification to be confirmed', drivetrain: 'Electric powertrain',
    features: ['Commercial heavy-duty vehicle', 'Designed for freight and fleet operations', 'Fleet suitability and delivery require confirmation', 'Contact management for a formal quotation'],
    colors: ['Factory finish preference', 'Custom fleet finish enquiry'], wheels: ['Standard configuration enquiry'] },
];

export function VehicleExperience({ modelId, onBack, onEnquire, onSelectModel, language = 'en' }: { modelId?: string; onBack: () => void; onEnquire: (context: string) => void; onSelectModel: (id: string) => void; language?: PublicLanguage; }) {
  const tr = (value: string) => publicText(value, language);
  const [color, setColor] = useState('Pearl White');
  const [wheel, setWheel] = useState('');
  const [payment, setPayment] = useState('Cash purchase enquiry');
  const [slide, setSlide] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [variantName, setVariantName] = useState('');
  const selected = models.find(model => model.id === modelId);
  const gallery = useMemo(() => selected?.gallery ?? [], [selected]);
  const activeSlide = gallery.length ? ((slide % gallery.length) + gallery.length) % gallery.length : 0;
  const variant = selected?.variants.find(item => item.name === variantName) || selected?.variants[0];
  const enquire = () => onEnquire([
    selected?.name || 'Vehicle enquiry', 'Selected version: ' + (variant?.name || 'Standard'),
    'Price: ' + (variant?.price || 'Request a quote'), 'Lease: ' + (selected?.lease || 'Not listed'),
    'Colour preference: ' + color, 'Wheel preference: ' + (wheel || 'To be confirmed'), 'Payment preference: ' + payment,
  ].join(' · '));

  useEffect(() => {
    if (!viewerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setViewerOpen(false);
      if (event.key === 'ArrowRight') setSlide(current => (current + 1) % gallery.length);
      if (event.key === 'ArrowLeft') setSlide(current => (current - 1 + gallery.length) % gallery.length);
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKeyDown); document.body.style.overflow = ''; };
  }, [viewerOpen, gallery.length]);

  const changeSlide = (direction: number) => setSlide(current => (current + direction + gallery.length) % gallery.length);

  if (!selected) {
    return <main className="vehicle-store">
      <section className="store-hero"><div className="eyebrow dark">TESLA MARKETS / VEHICLE COLLECTION</div><h1>{tr('Find your')}<br /><em>{tr('next electric drive.')}</em></h1><p>{tr('Explore each collection, compare versions and send a vehicle enquiry to management.')}</p><div className="store-count">{models.length} {tr('vehicle collections · USD catalogue display')}</div></section>
      <section className="store-grid">{models.map(model => <article className="store-card" key={model.id}>
        <button className="store-card-image" onClick={() => onSelectModel(model.id)} aria-label={tr('View ') + model.name + tr(' gallery')}><img src={model.gallery[0]} alt={model.name + ' vehicle'} loading="lazy" /><span>{model.gallery.length} {tr('PHOTOS · TESLA MARKETS COLLECTION')}</span></button>
        <div className="store-card-copy"><div className="eyebrow dark">{tr(model.subtitle)}</div><h2>{model.name}</h2><strong>{model.variants[0].price === 'Invite only' ? tr('Invite only') : tr('From ') + model.variants[0].price}</strong>{model.lease && <small>{tr(model.lease)}</small>}<small>{tr(model.priceNote)}</small><button className="btn btn-dark" onClick={() => onSelectModel(model.id)}>{tr('View gallery & details')} <ArrowUpRight size={16} /></button></div>
      </article>)}</section>
      <p className="store-disclaimer">{tr('Prices are management-provided catalogue starting prices. Final quotation, specification and availability are confirmed individually.')}</p>
    </main>;
  }

  return <main className="vehicle-configurator">
    <div className="config-top"><button className="config-back" onClick={onBack}><ArrowLeft size={16} />{tr('All vehicles')}</button><span className="eyebrow dark">TESLA MARKETS / VEHICLE DETAILS</span><span className="config-step">{String(activeSlide + 1).padStart(2, '0')} / {String(gallery.length).padStart(2, '0')} PHOTOS</span></div>
    <section className="config-layout">
      <div className="config-gallery">
        <div className="config-main-image"><button className="config-image-open" onClick={() => setViewerOpen(true)} aria-label="Open full-screen photo"><img key={gallery[activeSlide]} className="config-slide-image" src={gallery[activeSlide]} alt={selected.name + ' photo ' + (activeSlide + 1)} /><span className="config-expand-hint"><Maximize2 size={15} /> {tr('View full image')}</span></button>{gallery.length > 1 && <><button className="config-arrow config-prev" onClick={() => changeSlide(-1)} aria-label="Previous image"><ChevronLeft /></button><button className="config-arrow config-next" onClick={() => changeSlide(1)} aria-label="Next image"><ChevronRight /></button></>}</div>
        <div className="config-thumbs" aria-label={selected.name + ' image gallery'}>{gallery.map((src, index) => <button key={src} className={activeSlide === index ? 'selected' : ''} onClick={() => setSlide(index)} aria-label={tr('Show photo ') + (index + 1)}><img src={src} alt={selected.name + ' thumbnail ' + (index + 1)} loading="lazy" /><span>{String(index + 1).padStart(2, '0')}</span></button>)}</div>
        <p className="config-image-request">{tr('Tap the main photograph to open the full-screen viewer. Use the arrows or swipe to explore the gallery.')}</p>
      </div>
      <div className="config-options">
        <div className="eyebrow dark">{tr(selected.subtitle)}</div><h1>{selected.name}</h1>
        <div className="config-block"><div className="config-label">{tr('Choose your version')}</div><div className="config-choice-list">{selected.variants.map(item => <button key={item.name} className={(variant?.name === item.name ? 'chosen ' : '') + (item.inviteOnly ? 'invite-choice' : '')} onClick={() => setVariantName(item.name)}><span>{item.name}</span><b>{item.price}</b></button>)}</div></div>
        <div className="config-price">{variant?.price === 'Invite only' ? 'Invite only' : variant?.price}</div>
        <small className="config-price-note">{tr(selected.priceNote)}</small>
        {selected.lease && <div className="config-lease-price">{tr('Lease pricing:')} <b>{tr(selected.lease)}</b></div>}
        <div className="config-block"><div className="config-label"><span><Palette size={16} /> Colour preference</span><b>{color}</b></div><div className="color-options">{selected.colors.map((choice, index) => <button key={tr(choice)} className={color === choice ? 'chosen' : ''} onClick={() => setColor(choice)} aria-label={tr(choice)}><i className={'swatch swatch-' + (index % 6)} /></button>)}</div><small>{tr('Preferences are requests only; confirm available finishes with management.')}</small></div>
        <div className="config-block"><div className="config-label"><span><SlidersHorizontal size={16} /> Wheel / configuration preference</span></div><div className="config-choice-list">{selected.wheels.map(option => <button key={tr(option)} className={wheel === option ? 'chosen' : ''} onClick={() => setWheel(option)}>{tr(option)}{wheel === option && <Check size={15} />}</button>)}</div></div>
        <div className="config-block"><div className="config-label">{tr('Vehicle information')}</div><div className="config-specs"><div><small>{tr('Range')}</small><b>{tr(selected.range)}</b></div><div><small>{tr('Performance')}</small><b>{tr(selected.performance)}</b></div><div><small>{tr('Drivetrain')}</small><b>{tr(selected.drivetrain)}</b></div></div><ul className="config-features">{selected.features.map(feature => <li key={tr(feature)}><Check size={15} />{tr(feature)}</li>)}</ul></div>
        <div className="config-block"><div className="config-label">{tr('Checkout preference')}</div><div className="config-choice-list"><button className={payment === 'Cash purchase enquiry' ? 'chosen' : ''} onClick={() => setPayment('Cash purchase enquiry')}>{tr('Cash')}</button><button className={payment === 'Lease enquiry' ? 'chosen' : ''} onClick={() => setPayment('Lease enquiry')}>{tr('Lease')}</button><button className={payment === 'Finance enquiry' ? 'chosen' : ''} onClick={() => setPayment('Finance enquiry')}>{tr('Finance')}</button></div></div>
        <div className="config-checkout-summary"><span>{tr('Selected vehicle')}</span><b>{selected.name} · {variant?.name}</b><span>{tr('Vehicle price')}</span><strong>{variant?.price}</strong>{selected.lease && <small>{tr(selected.lease)}</small>}</div>
        <button className="btn btn-dark config-submit" onClick={enquire}>{tr('Order now / Enquire')} <ArrowUpRight size={17} /></button>
      </div>
    </section>
    {viewerOpen && <div className="image-lightbox" role="dialog" aria-modal="true" aria-label={selected.name + ' full-screen image viewer'} onClick={() => setViewerOpen(false)} onTouchStart={event => setTouchStart(event.touches[0].clientX)} onTouchEnd={event => { if (touchStart === null) return; const delta = event.changedTouches[0].clientX - touchStart; if (Math.abs(delta) > 45) changeSlide(delta < 0 ? 1 : -1); setTouchStart(null); }}>
      <div className="lightbox-top"><span>{selected.name} <small>{String(activeSlide + 1).padStart(2, '0')} / {String(gallery.length).padStart(2, '0')}</small></span><button onClick={() => setViewerOpen(false)} aria-label="Close full-screen viewer"><X /></button></div>
      <button className="lightbox-arrow lightbox-left" onClick={event => { event.stopPropagation(); changeSlide(-1); }} aria-label="Previous image"><ChevronLeft /></button><img key={gallery[activeSlide]} className="lightbox-image" src={gallery[activeSlide]} alt={selected.name + ' full-size photo ' + (activeSlide + 1)} onClick={event => event.stopPropagation()} /><button className="lightbox-arrow lightbox-right" onClick={event => { event.stopPropagation(); changeSlide(1); }} aria-label="Next image"><ChevronRight /></button>
      <div className="lightbox-bottom" onClick={event => event.stopPropagation()}><div className="lightbox-progress"><i style={{ width: ((activeSlide + 1) / gallery.length * 100) + '%' }} /></div><div className="lightbox-thumbs">{gallery.map((src, index) => <button key={src} className={activeSlide === index ? 'active' : ''} onClick={() => setSlide(index)} aria-label={'Open photo ' + (index + 1)}><img src={src} alt="" /></button>)}</div></div>
    </div>}
  </main>;
}

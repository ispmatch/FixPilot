// ═══════════════════════════════════════════════════════════════════════════
// widgetSchemaRegistry — Central registry for ALL builder widget/module schemas,
// natural language maps, and change type templates.
//
// This is the single source of truth that the orchestrator (and future
// functions) consult to know:
//   1. What native properties each widget type exposes
//   2. What natural-language phrases map to which widget type
//   3. What pre-built fix template matches the user's request
//
// Actions:
//   get_schemas    — returns { schemas, language_map } for a builder type
//   match_template — returns the best template match for a user message
//   get_context    — returns both schemas + template match in one call
// ═══════════════════════════════════════════════════════════════════════════

// ─── Elementor Widget Schemas (45 widget types) ───
const ELEMENTOR_WIDGET_SCHEMAS = {
  // Content Widgets
  'heading.default': {
    label: 'Heading',
    style_properties: { title_color: 'Heading text color (hex)', typography_font_size: 'Font size', typography_font_weight: 'Font weight', typography_text_transform: 'uppercase/lowercase/none', typography_font_style: 'normal/italic', typography_text_decoration: 'underline/none', typography_line_height: 'Line height', typography_letter_spacing: 'Letter spacing', typography_font_family: 'Font family' },
    content_properties: { title: 'The heading text', header_size: 'h1-h6/div/span/p', link: 'URL', align: 'left/center/right/justify' },
    fix_strategy: 'post_meta_update on _elementor_data — find widget by id, update settings.title_color or settings.title',
  },
  'text-editor.default': {
    label: 'Text Editor',
    style_properties: { editor_text_color: 'Text color (hex)', typography_font_size: 'Font size', typography_font_weight: 'Font weight', typography_line_height: 'Line height', typography_letter_spacing: 'Letter spacing', typography_font_family: 'Font family' },
    content_properties: { editor: 'HTML content of the text block', drop_cap: 'yes/no', align: 'left/center/right/justify' },
    fix_strategy: 'post_meta_update on _elementor_data — find widget by id, update settings.editor_text_color or settings.editor',
  },
  'button.default': {
    label: 'Button',
    style_properties: { background_color: 'Button background color', text_color: 'Button text color', border_border: 'solid/dashed/dotted/none', border_color: 'Border color', border_width: 'Border width', border_radius: 'Corner radius', typography_font_size: 'Font size', typography_font_weight: 'Font weight', typography_text_transform: 'uppercase/lowercase/none', background_hover_color: 'Hover bg', text_color_hover: 'Hover text color', border_hover_color: 'Hover border' },
    content_properties: { text: 'Button label', link: 'URL', selected_icon: 'Icon value', size: 'xs/sm/md/lg/xl', align: 'left/center/right/justified' },
    fix_strategy: 'post_meta_update — find widget by id, update settings.background_color or settings.text or settings.link',
  },
  'divider.default': {
    label: 'Divider',
    style_properties: { color: 'Line color', weight: 'Line thickness', width: 'Width', gap: 'Gap around divider', align: 'left/center/right' },
    content_properties: { text: 'Optional text on divider' },
    fix_strategy: 'post_meta_update — update settings.color',
  },
  'spacer.default': {
    label: 'Spacer', style_properties: { space: 'Height in px', spacer_divider: 'yes/no (show line)' }, content_properties: {},
    fix_strategy: 'post_meta_update — update settings.space',
  },
  'html.default': {
    label: 'HTML', style_properties: {}, content_properties: { html: 'Raw HTML content' },
    fix_strategy: 'post_meta_update — update settings.html',
  },
  'shortcode.default': {
    label: 'Shortcode', style_properties: {}, content_properties: { shortcode: 'Shortcode string e.g. [contact-form-7 id="123"]' },
    fix_strategy: 'post_meta_update — update settings.shortcode',
  },
  'alert.default': {
    label: 'Alert',
    style_properties: { alert_title_color: 'Title color', alert_description_color: 'Description color', alert_type: 'info/success/warning/danger', alert_background: 'Background color', alert_border: 'Border color' },
    content_properties: { alert_title: 'Alert title', alert_description: 'Alert message text', show_dismiss: 'yes/no' },
    fix_strategy: 'post_meta_update — update settings.alert_title or settings.alert_description',
  },
  'call-to-action.default': {
    label: 'Call to Action',
    style_properties: { title_color: 'Title color', description_color: 'Description color', button_background_color: 'Button bg', button_text_color: 'Button text color', wrapper_bg_color: 'Background color', button_border_radius: 'Button corner radius' },
    content_properties: { title: 'CTA title', description_text: 'Description', button_text: 'Button label', link: 'URL', image: 'Background image', position: 'left/right/top/bottom' },
    fix_strategy: 'post_meta_update — update settings.title or settings.button_text or settings.button_background_color',
  },
  // Media Widgets
  'image.default': {
    label: 'Image',
    style_properties: { space: 'Image space/spacing', border_border: 'border style', border_color: 'Border color', border_radius: 'Corner radius', opacity: 'Opacity (0-1)', hover_animation: 'none/zoom/blur/fade' },
    content_properties: { image: 'Attachment object {url, id, alt, source}', image_size: 'thumbnail/medium/full/custom', caption: 'Caption text', link_to: 'none/custom/file/attachment', link: 'URL for custom link', align: 'left/center/right/center', width: 'Custom width' },
    fix_strategy: 'post_meta_update — find widget by id, update settings.image or settings.image_size or settings.caption',
  },
  'image-box.default': {
    label: 'Image Box',
    style_properties: { title_color: 'Title color', description_color: 'Description color', title_typography_font_size: 'Title font size', description_typography_font_size: 'Description font size', image_border_radius: 'Image corner radius' },
    content_properties: { image: 'Image', title_text: 'Title text', description_text: 'Description text', link: 'URL', position: 'top/middle/bottom' },
    fix_strategy: 'post_meta_update — update settings.title_color or settings.title_text or settings.image',
  },
  'image-carousel.default': {
    label: 'Image Carousel',
    style_properties: { carousel_image_border_color: 'Border color', carousel_image_border_width: 'Border width', carousel_image_border_radius: 'Corner radius', carousel_image_spacing: 'Spacing between images', arrow_color: 'Arrow color', dot_color: 'Dot color', dot_active_color: 'Active dot color' },
    content_properties: { carousel: 'Array of {id, url, alt}', slides_to_show: 'Number of visible slides', slides_to_scroll: 'Slides per scroll', navigation: 'arrows/dots/both/none', autoplay: 'yes/no', pause_on_hover: 'yes/no', autoplay_speed: 'ms', infinite: 'yes/no', transition: 'slide/fade', image_size: 'thumbnail/medium/full' },
    fix_strategy: 'post_meta_update — update settings.carousel array or settings.slides_to_show or settings.autoplay',
  },
  'gallery.default': {
    label: 'Gallery',
    style_properties: { gallery_border_color: 'Border color', gallery_border_width: 'Border width', gallery_border_radius: 'Corner radius', gap: 'Gap between images', title_color: 'Caption color' },
    content_properties: { gallery: 'Array of image IDs', gallery_columns: 'Number of columns (1-10)', gallery_link: 'none/file/attachment', gallery_rand: 'yes/no', open_lightbox: 'yes/no/default' },
    fix_strategy: 'post_meta_update — update settings.gallery array or settings.gallery_columns',
  },
  'video.default': {
    label: 'Video',
    style_properties: { video_lightbox_color: 'Lightbox overlay color', play_icon_color: 'Play icon color', play_icon_background: 'Play icon bg', aspect_ratio: '16:9/4:3/3:2/21:9' },
    content_properties: { video_type: 'youtube/vimeo/dailymotion/hosted', link: 'Video URL', autoplay: 'yes/no', loop: 'yes/no', controls: 'yes/no', mute: 'yes/no', show_image_overlay: 'yes/no', image_overlay: 'Overlay image', lightbox: 'yes/no' },
    fix_strategy: 'post_meta_update — update settings.link or settings.video_type or settings.autoplay',
  },
  'audio.default': {
    label: 'Audio', style_properties: {}, content_properties: { audio_type: 'soundcloud/hosted', link: 'Audio URL', autoplay: 'yes/no', loop: 'yes/no' },
    fix_strategy: 'post_meta_update — update settings.link',
  },
  'media-carousel.default': {
    label: 'Media Carousel',
    style_properties: { slide_title_color: 'Slide title color', slide_description_color: 'Slide description color', slide_button_text_color: 'Button text color', slide_button_background_color: 'Button bg', navigation_color: 'Nav arrow color', dot_color: 'Dot color' },
    content_properties: { slides: 'Array of {image, title, description, button_text, link}', slides_to_show: 'Visible slides', navigation: 'arrows/dots/both/none', autoplay: 'yes/no', pause_on_hover: 'yes/no', transition: 'slide/fade', autoplay_speed: 'ms', infinite: 'yes/no' },
    fix_strategy: 'post_meta_update — update settings.slides array',
  },
  // Interactive Widgets
  'icon.default': {
    label: 'Icon',
    style_properties: { primary_color: 'Icon color', secondary_color: 'Icon secondary color', size: 'Icon size', border_color: 'Border color', border_width: 'Border width', border_radius: 'Corner radius', hover_animation: 'none/grow/shrink/pulse', hover_primary_color: 'Hover icon color' },
    content_properties: { selected_icon: 'Icon value {value, library}', link: 'URL', align: 'left/center/right' },
    fix_strategy: 'post_meta_update — find widget by id, update settings.primary_color or settings.selected_icon',
  },
  'icon-box.default': {
    label: 'Icon Box',
    style_properties: { title_color: 'Title color', description_color: 'Description color', primary_color: 'Icon color', title_typography_font_size: 'Title font size', description_typography_font_size: 'Description font size', icon_size: 'Icon size' },
    content_properties: { title_text: 'Title', description_text: 'Description', selected_icon: 'Icon {value, library}', link: 'URL', position: 'top/middle/bottom', view: 'default/stacked/framed' },
    fix_strategy: 'post_meta_update — update settings.title_color or settings.title_text or settings.primary_color',
  },
  'icon-list.default': {
    label: 'Icon List',
    style_properties: { icon_color: 'Icon color', text_color: 'Text color', icon_typography_font_size: 'Icon size', text_typography_font_size: 'Text size', divider_color: 'Divider line color' },
    content_properties: { icon_list: 'Array of {text, selected_icon, link}', space_between: 'Gap between items', divider: 'yes/no' },
    fix_strategy: 'post_meta_update — update settings.icon_list array or settings.icon_color',
  },
  'counter.default': {
    label: 'Counter',
    style_properties: { number_color: 'Number color', title_color: 'Title color', suffix_color: 'Suffix color', number_typography_font_size: 'Number font size', title_typography_font_size: 'Title font size' },
    content_properties: { starting_number: 'Start value', ending_number: 'End value', suffix: 'Suffix text', prefix: 'Prefix text', title: 'Title text', thousands_separator: 'yes/no' },
    fix_strategy: 'post_meta_update — update settings.number_color or settings.title or settings.ending_number',
  },
  'countdown.default': {
    label: 'Countdown',
    style_properties: { number_color: 'Number color', label_color: 'Label color', box_background_color: 'Box bg', box_border_color: 'Border color', box_border_radius: 'Corner radius' },
    content_properties: { due_date: 'Target date/time (Unix timestamp)', show_days: 'yes/no', show_hours: 'yes/no', show_minutes: 'yes/no', show_seconds: 'yes/no', custom_labels: 'Object with day/hour/minute/second labels' },
    fix_strategy: 'post_meta_update — update settings.due_date or settings.number_color',
  },
  'progress.default': {
    label: 'Progress Bar',
    style_properties: { bar_color: 'Progress bar color', bar_background_color: 'Track background', title_color: 'Title color', inner_text_color: 'Inner text color', bar_border_radius: 'Corner radius' },
    content_properties: { title: 'Title text', percent: 'Percentage (0-100)', display_percentage: 'yes/no', inner_text: 'Inner text (shown on bar)' },
    fix_strategy: 'post_meta_update — update settings.percent or settings.bar_color or settings.title',
  },
  'star-rating.default': {
    label: 'Star Rating',
    style_properties: { star_color: 'Star color', star_unmarked_color: 'Unmarked star color', star_size: 'Star size', space_between: 'Gap between stars' },
    content_properties: { rating: 'Rating number (0-5)', rating_scale: 'Scale (5 or 10)', title: 'Optional title', layout: 'inline/stacked' },
    fix_strategy: 'post_meta_update — update settings.rating or settings.star_color',
  },
  'testimonial.default': {
    label: 'Testimonial',
    style_properties: { testimonial_content_color: 'Content color', testimonial_name_color: 'Name color', testimonial_job_color: 'Job title color', image_border_color: 'Avatar border color', image_border_radius: 'Avatar corner radius', content_typography_font_size: 'Content font size' },
    content_properties: { testimonial_content: 'Content text', testimonial_name: 'Person name', testimonial_job: 'Job title', testimonial_image: 'Avatar image', testimonial_link: 'URL for name link' },
    fix_strategy: 'post_meta_update — update settings.testimonial_content_color or settings.testimonial_content',
  },
  'tabs.default': {
    label: 'Tabs',
    style_properties: { title_color: 'Tab title color', active_title_color: 'Active tab color', title_hover_color: 'Hover color', content_text_color: 'Content text color', border_color: 'Border color', background_color: 'Background color' },
    content_properties: { tabs: 'Array of {tab_title, tab_content}', view: 'horizontal/vertical' },
    fix_strategy: 'post_meta_update — update settings.title_color or settings.tabs',
  },
  'accordion.default': {
    label: 'Accordion',
    style_properties: { title_color: 'Title color', tab_active_color: 'Active tab color', title_hover_color: 'Hover color', content_text_color: 'Content color', border_color: 'Border color', background_color: 'Background color', icon_color: 'Icon color', icon_active_color: 'Active icon color' },
    content_properties: { tabs: 'Array of {tab_title, tab_content}', title_html_tag: 'h1-h6/div/span' },
    fix_strategy: 'post_meta_update — update settings.title_color or settings.tabs',
  },
  'toggle.default': {
    label: 'Toggle',
    style_properties: { title_color: 'Title color', tab_active_color: 'Active color', title_hover_color: 'Hover color', content_text_color: 'Content color', border_color: 'Border', background_color: 'Background' },
    content_properties: { tabs: 'Array of {tab_title, tab_content}', title_html_tag: 'h1-h6/div/span' },
    fix_strategy: 'post_meta_update — update settings.title_color or settings.tabs',
  },
  // Social / Sharing
  'social-icons.default': {
    label: 'Social Icons',
    style_properties: { icon_color: 'Icon color', icon_color_hover: 'Icon hover color', shape_color: 'Background shape color', shape_color_hover: 'Hover background', icon_size: 'Icon size', border_radius: 'Corner radius' },
    content_properties: { social_icon_list: 'Array of {social, link, is_external, value}', shape: 'circle/square/rounded', columns: 'Number of columns', align: 'left/center/right' },
    fix_strategy: 'post_meta_update — update settings.icon_color or settings.social_icon_list',
  },
  'share-buttons.default': {
    label: 'Share Buttons',
    style_properties: { share_button_size: 'Button size', share_button_color: 'Custom color', share_button_hover_color: 'Hover color', share_button_border_radius: 'Corner radius' },
    content_properties: { share_buttons: 'Array of {platform, text}', share_label: 'Label text', show_label: 'yes/no', view: 'icon-text/text/icon' },
    fix_strategy: 'post_meta_update — update settings.share_buttons or settings.share_button_color',
  },
  // Navigation
  'nav-menu.default': {
    label: 'Nav Menu',
    style_properties: { color_menu_item: 'Menu item color', color_menu_item_hover: 'Hover color', color_menu_item_active: 'Active item color', pointer_color: 'Pointer/indicator color', submenu_background_color: 'Submenu bg', submenu_text_color: 'Submenu text color', menu_typography_font_size: 'Font size', menu_typography_font_weight: 'Font weight' },
    content_properties: { menu: 'Menu ID', layout: 'horizontal/vertical/dropdown', submenu_icon: 'Submenu expand icon', pointer: 'none/underline/overline/framed/background' },
    fix_strategy: 'post_meta_update — update settings.color_menu_item or settings.menu',
  },
  'menu-anchor.default': {
    label: 'Menu Anchor', style_properties: {}, content_properties: { anchor: 'Anchor ID (for #link navigation)' },
    fix_strategy: 'post_meta_update — update settings.anchor',
  },
  'search-form.default': {
    label: 'Search Form',
    style_properties: { input_text_color: 'Input text color', input_background_color: 'Input bg', input_border_color: 'Border color', button_text_color: 'Button text color', button_background_color: 'Button bg', input_border_radius: 'Corner radius' },
    content_properties: { skin: 'classic/minimal/full', placeholder: 'Placeholder text', button_text: 'Button text', button_type: 'icon/text', size: 'sm/md/lg' },
    fix_strategy: 'post_meta_update — update settings.placeholder or settings.input_text_color',
  },
  // Pro Widgets
  'form.default': {
    label: 'Form (Elementor Pro)',
    style_properties: { field_text_color: 'Field text color', field_background_color: 'Field bg', field_border_color: 'Border color', field_focus_border_color: 'Focus border', label_color: 'Label color', button_background_color: 'Button bg', button_text_color: 'Button text color', button_hover_background_color: 'Hover bg', field_border_radius: 'Corner radius' },
    content_properties: { form_fields: 'Array of {custom_id, title, field_type (text/email/tel/textarea/select/checkbox/radio/acceptance/number/date/time/url/password), placeholder, required, width, _id}', form_name: 'Form name', submit_button_text: 'Submit button text', submit_actions: 'Array of actions (email, webhook, mailchimp, etc.)', redirect_to: 'Redirect URL after submit' },
    fix_strategy: 'post_meta_update — update settings.form_fields array or settings.submit_button_text or settings.field_text_color',
  },
  'animated-headline.default': {
    label: 'Animated Headline',
    style_properties: { headline_style_color: 'Headline color', highlighted_text_color: 'Highlighted text color', headline_style_typography_font_size: 'Font size', headline_style_typography_font_weight: 'Font weight' },
    content_properties: { headline: 'Headline text (before animated part)', animated_text: 'Animated/rotating words (comma-separated)', headline_style: 'rotate/words/chars', animation_type: 'typing/zoom/flip/pulse', loop: 'yes/no', rotation_speed: 'ms' },
    fix_strategy: 'post_meta_update — update settings.headline or settings.animated_text or settings.headline_style_color',
  },
  'flip-box.default': {
    label: 'Flip Box',
    style_properties: { title_color_a: 'Front title color', title_color_b: 'Back title color', description_color_a: 'Front description color', description_color_b: 'Back description color', background_color_a: 'Front bg', background_color_b: 'Back bg', button_text_color: 'Button text', button_background_color: 'Button bg', border_radius: 'Corner radius' },
    content_properties: { title_text_a: 'Front title', title_text_b: 'Back title', description_text_a: 'Front text', description_text_b: 'Back text', button_text: 'Button label', link: 'URL', image_a: 'Front image', image_b: 'Back image', graphic_element: 'none/icon/image', selected_icon: 'Icon value' },
    fix_strategy: 'post_meta_update — update settings.title_text_a or settings.description_text_b or settings.background_color_a',
  },
  'price-table.default': {
    label: 'Price Table',
    style_properties: { heading_color: 'Plan name color', sub_heading_color: 'Subheading color', price_color: 'Price color', period_color: 'Period color', features_color: 'Features text color', button_background_color: 'Button bg', button_text_color: 'Button text color', footer_background_color: 'Footer bg', header_background_color: 'Header bg', border_color: 'Border color' },
    content_properties: { heading: 'Plan name', sub_heading: 'Subtitle', price: 'Price value', period: 'Period text (e.g. /month)', features_list: 'Array of {text, icon}', button_text: 'Button label', link: 'URL', ribbon_text: 'Ribbon text' },
    fix_strategy: 'post_meta_update — update settings.heading or settings.price or settings.button_background_color',
  },
  'price-list.default': {
    label: 'Price List',
    style_properties: { title_color: 'Item title color', item_description_color: 'Description color', price_color: 'Price color', separator_color: 'Separator line color', title_typography_font_size: 'Title size', price_typography_font_size: 'Price size' },
    content_properties: { price_list: 'Array of {title, price, description, image, link}' },
    fix_strategy: 'post_meta_update — update settings.price_list array',
  },
  'posts.default': {
    label: 'Posts',
    style_properties: { title_color: 'Post title color', meta_color: 'Meta text color', excerpt_color: 'Excerpt color', read_more_color: 'Read more link color', pagination_color: 'Pagination color', thumbnail_border_radius: 'Image corner radius' },
    content_properties: { posts_post_type: 'Post type', posts_per_page: 'Items per page', orderby: 'Sort field', order: 'ASC/DESC', exclude_posts: 'Post IDs to exclude', thumbnail_size: 'thumbnail/medium/full', show_title: 'yes/no', show_excerpt: 'yes/no', show_read_more: 'yes/no', pagination_type: 'numbers/prev_next/load_more' },
    fix_strategy: 'post_meta_update — update settings.posts_post_type or settings.posts_per_page or settings.title_color',
  },
  'portfolio.default': {
    label: 'Portfolio',
    style_properties: { title_color: 'Title color', excerpt_color: 'Excerpt color', overlay_color: 'Hover overlay color', overlay_text_color: 'Overlay text color' },
    content_properties: { posts_per_page: 'Items per page', orderby: 'Sort field', order: 'ASC/DESC', show_filter: 'yes/no', layout: 'grid/justified/full-width', columns: 'Number of columns', gap: 'Gap between items', overlay: 'none/text/button/fade' },
    fix_strategy: 'post_meta_update — update settings.columns or settings.layout or settings.title_color',
  },
  'slides.default': {
    label: 'Slides',
    style_properties: { slide_title_color: 'Slide title color', slide_description_color: 'Slide description color', slide_button_text_color: 'Button text color', slide_button_background_color: 'Button bg', navigation_color: 'Nav arrow color', dot_color: 'Dot color', dot_active_color: 'Active dot color', content_position: 'top/middle/bottom' },
    content_properties: { slides: 'Array of {heading, description, button_text, link, background_image, background_color}', transition: 'slide/fade', transition_speed: 'ms', autoplay: 'yes/no', autoplay_speed: 'ms', loop: 'yes/no', navigation: 'arrows/dots/both/none', pause_on_hover: 'yes/no', ken_burns: 'yes/no' },
    fix_strategy: 'post_meta_update — update settings.slides array or settings.transition or settings.autoplay',
  },
  'hotspot.default': {
    label: 'Hotspot',
    style_properties: { hotspot_color: 'Hotspot dot color', hotspot_hover_color: 'Hover color', tooltip_text_color: 'Tooltip text color', tooltip_background_color: 'Tooltip bg', tooltip_border_radius: 'Tooltip corner radius', hotspot_size: 'Dot size' },
    content_properties: { image: 'Background image', hotspots: 'Array of {position_x, position_y, tooltip_content, tooltip_position (top/bottom/left/right), _id}', tooltip_trigger: 'click/hover' },
    fix_strategy: 'post_meta_update — update settings.hotspots array or settings.hotspot_color',
  },
  'login.default': {
    label: 'Login Form',
    style_properties: { field_text_color: 'Field text color', field_background_color: 'Field bg', field_border_color: 'Border color', label_color: 'Label color', button_background_color: 'Button bg', button_text_color: 'Button text color', button_hover_background_color: 'Hover bg', field_border_radius: 'Corner radius' },
    content_properties: { custom_labels: 'yes/no', user_label: 'Username label', password_label: 'Password label', button_text: 'Submit button text', show_remember_me: 'yes/no', show_lost_password: 'yes/no', show_register: 'yes/no', redirect_after_login: 'URL' },
    fix_strategy: 'post_meta_update — update settings.user_label or settings.button_text or settings.field_text_color',
  },
  'lottie.default': {
    label: 'Lottie Animation',
    style_properties: { play_speed: 'Playback speed', background_color: 'Background color', border_radius: 'Corner radius' },
    content_properties: { source_json_url: 'Lottie JSON URL', source: 'media_file/url', loop: 'yes/no', autoplay: 'yes/no', reverse: 'yes/no', view: 'default/stacked/framed', link: 'URL', trigger: 'arriving/in_view/on_hover/click' },
    fix_strategy: 'post_meta_update — update settings.source_json_url or settings.loop or settings.autoplay',
  },
  // Layout / Structure
  'container.default': {
    label: 'Container (Flexbox)',
    style_properties: { background_color: 'Background color', border_color: 'Border color', border_radius: 'Corner radius', padding: 'Padding {unit, top, right, bottom, left, isLinked}', margin: 'Margin', box_shadow: 'Shadow', min_height: 'Min height', overflow: 'hidden/visible', background_image: 'Background image' },
    content_properties: { flex_direction: 'row/column/row-reverse/column-reverse', justify_content: 'flex-start/center/flex-end/space-between/space-around/space-evenly', align_items: 'flex-start/center/flex-end/stretch/baseline', gap: 'Gap between children {size, unit}', content_width: 'boxed/full', html_tag: 'div/section/header/footer/main/aside', flex_wrap: 'nowrap/wrap/wrap-reverse' },
    fix_strategy: 'post_meta_update — update settings.flex_direction or settings.background_color or settings.padding or settings.justify_content',
  },
  'section.default': {
    label: 'Section (Legacy)',
    style_properties: { background_color: 'Background color', border_color: 'Border color', padding: 'Padding', margin: 'Margin', background_image: 'Background image', background_position: 'Position', background_attachment: 'scroll/fixed/parallax' },
    content_properties: { stretch_section: 'yes/no', content_position: 'top/middle/bottom', html_tag: 'div/section/header/footer', height: 'default/min-height', custom_height: 'Custom height' },
    fix_strategy: 'post_meta_update — update settings.background_color or settings.padding',
  },
  'sidebar.default': {
    label: 'Sidebar', style_properties: { align: 'Alignment', space: 'Spacing', background_color: 'Background color' },
    content_properties: { sidebar: 'Sidebar ID/name from Appearance → Widgets' },
    fix_strategy: 'post_meta_update — update settings.sidebar',
  },
  'google_maps.default': {
    label: 'Google Maps', style_properties: {},
    content_properties: { address: 'Address string', zoom: 'Zoom level (1-20)', height: 'Map height in px', prevent_scroll: 'yes/no (disable zoom on scroll)', view: 'roadmap/satellite/hybrid/terrain' },
    fix_strategy: 'post_meta_update — update settings.address or settings.zoom',
  },
  // WooCommerce Widgets
  'woocommerce-products.default': {
    label: 'WooCommerce Products',
    style_properties: { title_color: 'Product title color', price_color: 'Price color', button_background_color: 'Button bg', button_text_color: 'Button text color', title_typography_font_size: 'Title size', price_typography_font_size: 'Price size' },
    content_properties: { query: 'Array of {post_type, posts_per_page, orderby, order, exclude, include}', columns: 'Grid columns (1-6)', paginate: 'yes/no', allow_order: 'yes/no', show_result_count: 'yes/no' },
    fix_strategy: 'post_meta_update — update settings.query or settings.columns or settings.title_color',
  },
  'woocommerce-product-price.default': {
    label: 'Product Price',
    style_properties: { price_color: 'Price color', price_typography_font_size: 'Font size', price_typography_font_weight: 'Font weight' }, content_properties: {},
    fix_strategy: 'post_meta_update — update settings.price_color',
  },
  'woocommerce-product-add-to-cart.default': {
    label: 'Add to Cart',
    style_properties: { button_background_color: 'Button bg', button_text_color: 'Button text color', button_border_color: 'Border color', button_border_radius: 'Corner radius', button_hover_background_color: 'Hover bg' },
    content_properties: { button_text: 'Button label text' },
    fix_strategy: 'post_meta_update — update settings.button_text or settings.button_background_color',
  },
  'woocommerce-product-images.default': {
    label: 'Product Images',
    style_properties: { thumbnail_border_color: 'Thumbnail border', thumbnail_border_radius: 'Corner radius' },
    content_properties: { zoom: 'yes/no', lightbox: 'yes/no' },
    fix_strategy: 'post_meta_update — update settings.thumbnail_border_color',
  },
  'woocommerce-breadcrumb.default': {
    label: 'WooCommerce Breadcrumb',
    style_properties: { text_color: 'Text color', link_color: 'Link color', link_hover_color: 'Hover color', typography_font_size: 'Font size' }, content_properties: {},
    fix_strategy: 'post_meta_update — update settings.text_color',
  },
};

// ─── Natural Language → Widget Type Map ───
const WIDGET_LANGUAGE_MAP = {
  'heading.default': ['heading', 'title text', 'headline', 'big text', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'page title', 'section title', 'main heading'],
  'text-editor.default': ['paragraph', 'body text', 'text block', 'description text', 'content text', 'long text', 'rich text', 'text content', 'body copy'],
  'button.default': ['button', 'cta', 'call to action', 'click here', 'submit button', 'buy now', 'read more button', 'link button', 'action button', 'sign up button'],
  'icon.default': ['icon', 'symbol', 'glyph', 'emblem'],
  'image.default': ['image', 'photo', 'picture', 'logo image', 'banner image', 'hero image', 'feature image', 'product image'],
  'image-box.default': ['image box', 'image with text', 'image and title', 'image card'],
  'icon-box.default': ['icon box', 'icon with text', 'icon and title', 'feature box', 'icon card', 'feature card'],
  'image-carousel.default': ['carousel', 'image carousel', 'image slider', 'photo carousel', 'gallery slider', 'slideshow', 'image scroller'],
  'gallery.default': ['gallery', 'photo grid', 'image grid', 'photo gallery', 'image gallery', 'grid of images'],
  'video.default': ['video', 'youtube', 'vimeo', 'video player', 'embed video', 'video embed', 'video clip'],
  'audio.default': ['audio', 'audio player', 'podcast', 'music player', 'soundcloud'],
  'media-carousel.default': ['media carousel', 'media slider', 'content slider', 'slide carousel'],
  'testimonial.default': ['testimonial', 'review', 'customer quote', 'feedback', 'client testimonial', 'customer review'],
  'counter.default': ['counter', 'number counter', 'stats counter', 'count up', 'statistics'],
  'countdown.default': ['countdown', 'timer', 'countdown timer', 'deadline', 'event countdown', 'time remaining'],
  'progress.default': ['progress bar', 'progress', 'progress indicator', 'skill bar', 'loading bar'],
  'star-rating.default': ['star rating', 'rating', 'stars', 'review stars', 'star score', 'five star'],
  'divider.default': ['divider', 'separator', 'line break', 'horizontal line'],
  'spacer.default': ['spacer', 'gap', 'empty space', 'whitespace', 'blank space'],
  'social-icons.default': ['social icons', 'social media icons', 'social links', 'facebook icon', 'instagram icon', 'twitter icon', 'linkedin icon', 'youtube icon'],
  'share-buttons.default': ['share buttons', 'social share', 'share icons', 'share links'],
  'tabs.default': ['tabs', 'tabbed content', 'tabbed section', 'tabbed panel', 'tab layout'],
  'accordion.default': ['accordion', 'collapsible', 'faq', 'expandable section', 'foldable content', 'faq section'],
  'toggle.default': ['toggle', 'toggle switch', 'on/off', 'toggle content'],
  'alert.default': ['alert', 'notice', 'callout', 'warning box', 'info box', 'message box', 'banner alert'],
  'html.default': ['html', 'custom code', 'embed code', 'raw html', 'custom html'],
  'shortcode.default': ['shortcode', 'shortcode embed', 'plugin shortcode'],
  'nav-menu.default': ['navigation menu', 'nav menu', 'menu bar', 'main menu', 'header menu', 'menu links', 'top menu'],
  'menu-anchor.default': ['anchor', 'menu anchor', 'jump link', 'scroll target', 'section anchor'],
  'search-form.default': ['search form', 'search bar', 'search box', 'search field'],
  'form.default': ['form', 'contact form', 'input form', 'registration form', 'signup form', 'newsletter form', 'submission form', 'inquiry form'],
  'animated-headline.default': ['animated headline', 'rotating text', 'typing text', 'changing text', 'animated title', 'rotating headline'],
  'call-to-action.default': ['call to action', 'cta', 'cta box', 'cta section', 'call out box', 'promo box', 'banner cta'],
  'flip-box.default': ['flip box', 'flip card', 'flip animation', 'hover flip', 'flip card'],
  'price-table.default': ['price table', 'pricing table', 'pricing card', 'plan card', 'pricing plan', 'subscription plan', 'membership plan'],
  'price-list.default': ['price list', 'menu list', 'price menu', 'service list', 'restaurant menu', 'services list'],
  'posts.default': ['posts', 'blog posts', 'recent posts', 'post grid', 'post list', 'blog feed', 'article list', 'blog listing'],
  'portfolio.default': ['portfolio', 'projects', 'portfolio grid', 'work portfolio', 'portfolio gallery', 'project showcase'],
  'slides.default': ['slides', 'slider', 'hero slider', 'banner slider', 'image slides', 'slide show'],
  'hotspot.default': ['hotspot', 'image hotspot', 'interactive image', 'image with points', 'clickable points', 'pinpoint'],
  'login.default': ['login form', 'login', 'signin', 'sign in', 'login page', 'login box', 'login widget'],
  'lottie.default': ['lottie', 'lottie animation', 'json animation', 'animated icon', 'vector animation'],
  'google_maps.default': ['map', 'google map', 'location map', 'maps embed', 'google maps', 'directions'],
  'container.default': ['container', 'flexbox', 'flex container', 'column', 'row', 'layout container', 'content wrapper', 'section wrapper'],
  'section.default': ['section', 'page section', 'content section', 'row section'],
  'sidebar.default': ['sidebar', 'widget area', 'side panel', 'side column'],
  'icon-list.default': ['icon list', 'list with icons', 'feature list', 'bullet list with icons', 'checklist'],
  'woocommerce-products.default': ['product grid', 'products grid', 'shop grid', 'woocommerce products', 'product listing', 'shop products', 'store products'],
  'woocommerce-product-price.default': ['product price', 'price text', 'woocommerce price', 'product price display'],
  'woocommerce-product-add-to-cart.default': ['add to cart button', 'add to cart', 'buy button', 'woocommerce button', 'purchase button'],
  'woocommerce-product-images.default': ['product images', 'product gallery', 'product photos', 'product image gallery'],
  'woocommerce-breadcrumb.default': ['breadcrumb', 'woocommerce breadcrumb', 'navigation trail', 'breadcrumb trail'],
};

// ─── Change Type Templates ───
const CHANGE_TYPE_TEMPLATES = [
  { name: 'text_color_change', keywords: ['color', 'colour', 'pink', 'red', 'blue', 'green', 'orange', 'yellow', 'purple', 'black', 'white', 'grey', 'gray', 'text color', 'text colour', 'font color', 'font colour', 'make.*color', 'change.*color'],
    widget_types: ['heading.default', 'text-editor.default', 'button.default', 'call-to-action.default', 'price-table.default', 'icon-box.default', 'testimonial.default'],
    change_type: 'post_content_patch', builder_types: ['elementor', 'divi', 'gutenberg', 'unknown'],
    build_hint: 'post_content_patch: target=page slug, value=JSON {"search":"target text","replace":"<span style=\\"color: {COLOR} !important;\\">target text</span>"}' },
  { name: 'text_content_change', keywords: ['change text', 'replace text', 'update text', 'rename', 'change wording', 'new text', 'edit text', 'change title', 'change heading', 'change button text', 'change label', 'change word', 'say'],
    widget_types: ['heading.default', 'text-editor.default', 'button.default', 'call-to-action.default', 'nav-menu.default', 'alert.default'],
    change_type: 'post_content_patch', builder_types: ['elementor', 'divi', 'gutenberg', 'unknown'],
    build_hint: 'post_content_patch: target=page slug, value=JSON {"search":"old text","replace":"new text"}' },
  { name: 'font_size_change', keywords: ['font size', 'bigger text', 'smaller text', 'larger font', 'smaller font', 'increase font', 'decrease font', 'text size', 'make text bigger', 'make text smaller', 'font bigger', 'font smaller'],
    widget_types: ['heading.default', 'text-editor.default', 'button.default', 'call-to-action.default', 'icon-box.default', 'testimonial.default'],
    change_type: 'post_meta_update', builder_types: ['elementor', 'divi'],
    build_hint: 'post_meta_update: target=page slug, value=JSON {"meta_key":"_elementor_data","meta_value":{"widget_id":"<id>","updates":{"typography_font_size":{"unit":"px","size":N}}}}' },
  { name: 'font_weight_style', keywords: ['bold', 'italic', 'underline', 'uppercase', 'lowercase', 'capitalize', 'font weight', 'font style', 'make bold', 'make italic', 'text transform'],
    widget_types: ['heading.default', 'text-editor.default', 'button.default', 'call-to-action.default'],
    change_type: 'post_meta_update', builder_types: ['elementor', 'divi'],
    build_hint: 'post_meta_update: updates={"typography_font_weight":"bold/600","typography_font_style":"italic","typography_text_transform":"uppercase"}' },
  { name: 'background_color_change', keywords: ['background color', 'bg color', 'background colour', 'change background', 'section background', 'button background', 'container background', 'box background', 'area background'],
    widget_types: ['button.default', 'container.default', 'section.default', 'call-to-action.default', 'price-table.default', 'alert.default', 'icon-box.default'],
    change_type: 'post_meta_update', builder_types: ['elementor', 'divi'],
    build_hint: 'post_meta_update: updates={"background_color":"#hex"} or {"button_background_color":"#hex"} for buttons specifically' },
  { name: 'image_swap', keywords: ['change image', 'swap image', 'replace image', 'new image', 'update image', 'change photo', 'replace photo', 'new photo', 'change picture', 'replace picture'],
    widget_types: ['image.default', 'image-box.default', 'image-carousel.default', 'call-to-action.default', 'hotspot.default', 'slides.default'],
    change_type: 'post_meta_update', builder_types: ['elementor', 'divi'],
    build_hint: 'post_meta_update: updates={"image":{"url":"NEW_URL","id":ATTACHMENT_ID,"alt":"alt text","source":"library"}}' },
  { name: 'image_resize_dimensions', keywords: ['resize image', 'image size', 'image width', 'image height', 'make image smaller', 'make image bigger', 'image dimensions', 'thumbnail size', 'full size'],
    widget_types: ['image.default', 'image-box.default', 'gallery.default', 'image-carousel.default'],
    change_type: 'post_meta_update', builder_types: ['elementor'],
    build_hint: 'post_meta_update: updates={"image_size":"full/medium/thumbnail/custom","image_custom_dimension":{"width":W,"height":H}}' },
  { name: 'alignment_change', keywords: ['align', 'center', 'left align', 'right align', 'justify', 'center text', 'align left', 'align right', 'text align', 'horizontal align', 'move left', 'move right'],
    widget_types: ['heading.default', 'text-editor.default', 'button.default', 'icon.default', 'image.default', 'icon-box.default', 'container.default'],
    change_type: 'post_meta_update', builder_types: ['elementor', 'divi', 'gutenberg'],
    build_hint: 'post_meta_update: updates={"align":"left/center/right/justify"}' },
  { name: 'spacing_padding_margin', keywords: ['spacing', 'padding', 'margin', 'space around', 'gap', 'too close', 'too far', 'more space', 'less space', 'inner spacing', 'outer spacing', 'tighten', 'loosen', 'add space', 'reduce space'],
    widget_types: ['heading.default', 'button.default', 'image.default', 'container.default', 'section.default', 'icon-box.default', 'spacer.default'],
    change_type: 'post_meta_update', builder_types: ['elementor', 'divi'],
    build_hint: 'post_meta_update: updates={"padding":{"unit":"px","top":N,"right":N,"bottom":N,"left":N,"isLinked":true/false},"margin":{...}}' },
  { name: 'border_radius_shadow', keywords: ['border', 'radius', 'corner', 'rounded', 'sharp corners', 'box shadow', 'drop shadow', 'border color', 'border width', 'border style', 'rounded corners', 'curved corners'],
    widget_types: ['button.default', 'image.default', 'container.default', 'icon.default', 'icon-box.default'],
    change_type: 'post_meta_update', builder_types: ['elementor'],
    build_hint: 'post_meta_update: updates={"border_border":"solid/dashed/dotted","border_color":"#hex","border_width":{"unit":"px","size":N},"border_radius":{"unit":"px","size":N}}' },
  { name: 'link_url_change', keywords: ['change link', 'update link', 'new url', 'change url', 'update url', 'redirect', 'link to', 'point to', 'hyperlink', 'change button link', 'change destination'],
    widget_types: ['button.default', 'image.default', 'heading.default', 'call-to-action.default', 'icon-box.default', 'nav-menu.default'],
    change_type: 'post_meta_update', builder_types: ['elementor', 'divi', 'gutenberg'],
    build_hint: 'post_meta_update: updates={"link":{"url":"https://...","is_external":true/false,"nofollow":true/false}}' },
  { name: 'hide_show_element', keywords: ['hide', 'show', 'remove element', 'make invisible', 'make visible', 'display none', 'conceal', 'reveal', 'hide on mobile', 'hide on desktop'],
    widget_types: ['heading.default', 'button.default', 'image.default', 'text-editor.default', 'container.default'],
    change_type: 'post_meta_update', builder_types: ['elementor'],
    build_hint: 'post_meta_update: updates={"hide_mobile":"yes/no","hide_tablet":"yes/no","hide_desktop":"yes/no"}' },
  { name: 'opacity_change', keywords: ['opacity', 'transparent', 'transparency', 'fade', 'see through', 'semi transparent', 'make opaque', 'make transparent'],
    widget_types: ['image.default', 'button.default', 'container.default', 'section.default', 'divider.default'],
    change_type: 'post_meta_update', builder_types: ['elementor'],
    build_hint: 'post_meta_update: updates={"opacity":0.5} (0-1 scale)' },
  { name: 'woocommerce_sale_price', keywords: ['sale', 'discount', 'reduce price', 'sale price', 'on sale', 'mark down', 'price drop', 'offer price', 'percentage off', 'percent off', 'discount price'],
    widget_types: ['woocommerce-products.default', 'woocommerce-product-price.default', 'woocommerce-product-add-to-cart.default'],
    change_type: 'woocommerce_product_update', builder_types: ['elementor', 'gutenberg'],
    build_hint: 'woocommerce_product_update: target=category slug or ids:123,456, value=JSON {"action":"sale","discount_amount":N,"discount_type":"fixed|percentage","sale_price_dates_from":"YYYY-MM-DD","sale_price_dates_to":"YYYY-MM-DD"}' },
  { name: 'menu_label_change', keywords: ['menu item', 'nav label', 'menu label', 'rename menu', 'change menu text', 'navigation label', 'menu link text', 'change navigation'],
    widget_types: ['nav-menu.default'],
    change_type: 'menu_update', builder_types: ['elementor', 'gutenberg', 'unknown'],
    build_hint: 'menu_update: target=current menu label, value=new label text' },
  { name: 'form_field_label', keywords: ['field label', 'form label', 'placeholder', 'input label', 'required field', 'optional field', 'field name', 'form field', 'change form', 'contact form'],
    widget_types: ['form.default'],
    change_type: 'post_meta_update', builder_types: ['elementor'],
    build_hint: 'post_meta_update: updates={"form_fields":[{...updated field objects...}]} — modify field array, change custom_id/title/placeholder/required' },
  { name: 'carousel_settings', keywords: ['autoplay', 'carousel speed', 'slider speed', 'slide transition', 'pause on hover', 'infinite loop', 'slide count', 'visible slides', 'slides to show', 'slide duration'],
    widget_types: ['image-carousel.default', 'media-carousel.default', 'slides.default', 'testimonial.default'],
    change_type: 'post_meta_update', builder_types: ['elementor'],
    build_hint: 'post_meta_update: updates={"autoplay":"yes/no","autoplay_speed":N,"pause_on_hover":"yes/no","slides_to_show":N,"transition":"slide/fade","infinite":"yes/no"}' },
];

function matchChangeTemplate(message) {
  const msgLower = (message || '').toLowerCase();
  const scored = CHANGE_TYPE_TEMPLATES.map(t => {
    let score = 0;
    for (const kw of t.keywords) {
      if (kw.includes('.*')) {
        if (new RegExp(kw, 'i').test(msgLower)) score += 3;
      } else if (msgLower.includes(kw)) {
        score += kw.length > 4 ? 3 : 2;
      }
    }
    return { template: t, score };
  }).filter(s => s.score > 0).sort((a, b) => b.score - a.score);
  if (!scored.length) return null;
  const best = scored[0];
  return {
    template_name: best.template.name,
    description: best.template.name.replace(/_/g, ' '),
    change_type: best.template.change_type,
    widget_types: best.template.widget_types,
    build_hint: best.template.build_hint,
    score: best.score,
    confidence: best.score >= 6 ? 'high' : best.score >= 3 ? 'medium' : 'low',
  };
}

// ─── Divi Module Schemas ───
const DIVI_MODULE_SCHEMAS = {
  'et_pb_text': { label: 'Text', content_properties: { content: 'HTML content' }, style_properties: { text_text_color: 'Text color', text_font_size: 'Font size', text_font_weight: 'Font weight', text_orientation: 'left/center/right/justified', module_bg: 'Background color' }, fix_strategy: 'post_content_patch or post_update — modify shortcode content attribute' },
  'et_pb_button': { label: 'Button', content_properties: { button_text: 'Button label', button_url: 'Link URL' }, style_properties: { button_bg_color: 'Button bg', button_text_color: 'Button text color', button_border_color: 'Border color', button_border_radius: 'Corner radius', button_font_size: 'Font size' }, fix_strategy: 'post_update — modify button_text/button_url/button_bg_color shortcode attrs' },
  'et_pb_image': { label: 'Image', content_properties: { src: 'Image URL', alt: 'Alt text', title_text: 'Title text', url: 'Link URL' }, style_properties: { border_color: 'Border color', border_radius: 'Corner radius', force_fullwidth: 'yes/no', alignment: 'left/center/right' }, fix_strategy: 'post_update — modify src/alt shortcode attrs' },
  'et_pb_blurb': { label: 'Blurb (Icon+Text)', content_properties: { title: 'Title text', content: 'Body text', image: 'Icon image URL', icon: 'Icon name', url: 'Link URL' }, style_properties: { header_color: 'Title color', text_color: 'Text color', use_icon_color: 'Icon color', background_color: 'Background color' }, fix_strategy: 'post_update — modify title/content shortcode attrs' },
  'et_pb_gallery': { label: 'Gallery', content_properties: { gallery_ids: 'Array of image IDs', gallery_orderby: 'Sort field', gallery_columns: 'Number of columns' }, style_properties: { zoom_icon_color: 'Zoom icon color', hover_overlay_color: 'Hover overlay color' }, fix_strategy: 'post_update — modify gallery_ids shortcode attr' },
  'et_pb_slider': { label: 'Slider', content_properties: { slides: 'Array of {image, alt, title, content, button_text, button_link}' }, style_properties: { slider_bg_color: 'Slide bg', slider_text_color: 'Text color', slider_title_color: 'Title color' }, fix_strategy: 'post_update — modify slide shortcode attrs' },
  'et_pb_tabs': { label: 'Tabs', content_properties: { tabs: 'Array of {title, content}' }, style_properties: { tab_text_color: 'Tab text', active_tab_text_color: 'Active tab text', tab_background_color: 'Tab bg' }, fix_strategy: 'post_update — modify tab shortcode content' },
  'et_pb_accordion': { label: 'Accordion', content_properties: { tabs: 'Array of {title, content}' }, style_properties: { toggle_text_color: 'Toggle text', active_toggle_text_color: 'Active toggle', toggle_background_color: 'Toggle bg' }, fix_strategy: 'post_update — modify toggle shortcode content' },
  'et_pb_toggle': { label: 'Toggle', content_properties: { title: 'Toggle title', content: 'Toggle content' }, style_properties: { toggle_text_color: 'Text color', toggle_background_color: 'Background' }, fix_strategy: 'post_update — modify title/content shortcode attrs' },
  'et_pb_contact_form': { label: 'Contact Form', content_properties: { email: 'Recipient email', title: 'Form title', fields: 'Array of {field_id, label, type, required}' }, style_properties: { form_field_text_color: 'Field text', form_field_background_color: 'Field bg', button_text_color: 'Button text', button_bg_color: 'Button bg' }, fix_strategy: 'post_update — modify field shortcode attrs' },
  'et_pb_blog': { label: 'Blog', content_properties: { posts_number: 'Items per page', include_categories: 'Category IDs', orderby: 'Sort field', show_thumbnail: 'on/off', show_content: 'on/off', show_author: 'on/off', show_date: 'on/off', show_categories: 'on/off' }, style_properties: { header_color: 'Title color', meta_color: 'Meta text color', body_text_color: 'Body text color' }, fix_strategy: 'post_update — modify shortcode attrs' },
  'et_pb_cta': { label: 'Call to Action', content_properties: { title: 'CTA title', button_text: 'Button label', button_url: 'Button URL', content: 'Body text' }, style_properties: { header_color: 'Title color', body_text_color: 'Body text', button_bg_color: 'Button bg', button_text_color: 'Button text' }, fix_strategy: 'post_update — modify title/button_text/content shortcode attrs' },
  'et_pb_countdown_timer': { label: 'Countdown Timer', content_properties: { date_time: 'Target date/time', timer_background_color: 'Background' }, style_properties: { timer_number_color: 'Number color', timer_label_color: 'Label color' }, fix_strategy: 'post_update — modify date_time shortcode attr' },
  'et_pb_number_counter': { label: 'Number Counter', content_properties: { number: 'Target number', title: 'Title text' }, style_properties: { number_color: 'Number color', title_color: 'Title color' }, fix_strategy: 'post_update — modify number/title shortcode attrs' },
  'et_pb_pricing_tables': { label: 'Pricing Tables', content_properties: { tables: 'Array of {title, subtitle, currency, price, period, features, button_text, button_url}' }, style_properties: { header_background_color: 'Header bg', subheader_color: 'Subheader color', price_color: 'Price color', button_bg_color: 'Button bg' }, fix_strategy: 'post_update — modify pricing table shortcode attrs' },
  'et_pb_testimonial': { label: 'Testimonial', content_properties: { author: 'Person name', job_title: 'Job title', content: 'Testimonial text', portrait_url: 'Avatar URL' }, style_properties: { testimonial_text_color: 'Text color', author_color: 'Author name color' }, fix_strategy: 'post_update — modify author/content shortcode attrs' },
  'et_pb_video': { label: 'Video', content_properties: { src: 'Video URL', image: 'Placeholder image URL' }, style_properties: {}, fix_strategy: 'post_update — modify src shortcode attr' },
  'et_pb_map': { label: 'Map', content_properties: { address: 'Address', zoom: 'Zoom level', height: 'Map height' }, style_properties: {}, fix_strategy: 'post_update — modify address shortcode attr' },
};

const DIVI_LANGUAGE_MAP = {
  'et_pb_text': ['text', 'paragraph', 'body text', 'content'],
  'et_pb_button': ['button', 'cta', 'call to action'],
  'et_pb_image': ['image', 'photo', 'picture'],
  'et_pb_blurb': ['blurb', 'icon with text', 'feature box'],
  'et_pb_gallery': ['gallery', 'photo grid'],
  'et_pb_slider': ['slider', 'slides', 'carousel'],
  'et_pb_tabs': ['tabs', 'tabbed'],
  'et_pb_accordion': ['accordion', 'faq', 'collapsible'],
  'et_pb_toggle': ['toggle', 'on/off'],
  'et_pb_contact_form': ['contact form', 'form'],
  'et_pb_blog': ['blog', 'posts', 'blog feed'],
  'et_pb_cta': ['cta', 'call to action'],
  'et_pb_countdown_timer': ['countdown', 'timer'],
  'et_pb_number_counter': ['counter', 'count up'],
  'et_pb_pricing_tables': ['pricing', 'price table'],
  'et_pb_testimonial': ['testimonial', 'review'],
  'et_pb_video': ['video', 'youtube', 'vimeo'],
  'et_pb_map': ['map', 'google map'],
};

const BEAVER_WIDGET_SCHEMAS = {
  'button': { label: 'Button', content_properties: { text: 'Button text', link: 'URL' }, style_properties: { bg_color: 'Button bg', text_color: 'Text color', border_radius: 'Corner radius' }, fix_strategy: 'post_meta_update on _fl_builder_data' },
  'heading': { label: 'Heading', content_properties: { heading: 'Heading text', tag: 'h1-h6' }, style_properties: { color: 'Text color', font_size: 'Font size' }, fix_strategy: 'post_meta_update on _fl_builder_data' },
  'photo': { label: 'Photo', content_properties: { photo_src: 'Image URL', caption: 'Caption' }, style_properties: { border_color: 'Border', border_radius: 'Corner radius' }, fix_strategy: 'post_meta_update on _fl_builder_data' },
  'text-editor': { label: 'Text Editor', content_properties: { text: 'HTML content' }, style_properties: { text_color: 'Text color' }, fix_strategy: 'post_meta_update on _fl_builder_data' },
  'icon': { label: 'Icon', content_properties: { icon: 'Icon value', link: 'URL' }, style_properties: { color: 'Icon color', size: 'Icon size' }, fix_strategy: 'post_meta_update on _fl_builder_data' },
  'testimonial': { label: 'Testimonial', content_properties: { testimonial: 'Content', name: 'Person name' }, style_properties: { testimonial_color: 'Content color', name_color: 'Name color' }, fix_strategy: 'post_meta_update on _fl_builder_data' },
};

const BEAVER_LANGUAGE_MAP = {
  'button': ['button', 'cta', 'call to action'],
  'heading': ['heading', 'title', 'headline'],
  'photo': ['image', 'photo', 'picture'],
  'text-editor': ['text', 'paragraph', 'body text'],
  'icon': ['icon', 'symbol'],
  'testimonial': ['testimonial', 'review'],
};

const GUTENBERG_BLOCK_SCHEMAS = {
  'core/heading': { label: 'Heading', content_properties: { content: 'Heading text', level: '1-6' }, style_properties: { textColor: 'Text color', fontSize: 'Font size' }, fix_strategy: 'post_content_patch or post_update' },
  'core/paragraph': { label: 'Paragraph', content_properties: { content: 'HTML content' }, style_properties: { textColor: 'Text color', fontSize: 'Font size' }, fix_strategy: 'post_content_patch or post_update' },
  'core/button': { label: 'Button', content_properties: { text: 'Button label', url: 'Link URL' }, style_properties: { backgroundColor: 'Button bg', textColor: 'Text color', borderRadius: 'Corner radius' }, fix_strategy: 'post_content_patch or post_update' },
  'core/image': { label: 'Image', content_properties: { url: 'Image URL', alt: 'Alt text', caption: 'Caption' }, style_properties: { className: 'CSS class for styling' }, fix_strategy: 'post_content_patch or post_update' },
  'core/gallery': { label: 'Gallery', content_properties: { ids: 'Array of image IDs', columns: 'Number of columns' }, style_properties: {}, fix_strategy: 'post_content_patch or post_update' },
  'core/quote': { label: 'Quote', content_properties: { value: 'Quote text', citation: 'Author' }, style_properties: { className: 'CSS class' }, fix_strategy: 'post_content_patch or post_update' },
};

const GUTENBERG_LANGUAGE_MAP = {
  'core/heading': ['heading', 'title', 'headline'],
  'core/paragraph': ['paragraph', 'text', 'body text'],
  'core/button': ['button', 'cta'],
  'core/image': ['image', 'photo', 'picture'],
  'core/gallery': ['gallery', 'photo grid'],
  'core/quote': ['quote', 'blockquote', 'citation'],
};

// ─── Builder Schema Registry ───
const BUILDER_SCHEMA_REGISTRY = {
  elementor: { fix_strategy: 'post_meta_update on _elementor_data (surgical widget merge by widget_id)', css_clear: 'per-post only (delete _elementor_css meta — NEVER global clear_cache)', widgets: ELEMENTOR_WIDGET_SCHEMAS, language_map: WIDGET_LANGUAGE_MAP },
  divi: { fix_strategy: 'post_update (Divi stores modules as shortcodes in post_content) or post_content_patch', css_clear: 'no special CSS clearing — Divi regenerates on render', widgets: DIVI_MODULE_SCHEMAS, language_map: DIVI_LANGUAGE_MAP },
  beaver_builder: { fix_strategy: 'post_meta_update on _fl_builder_data (JSON layout data)', css_clear: 'no special CSS clearing — Beaver regenerates on render', widgets: BEAVER_WIDGET_SCHEMAS, language_map: BEAVER_LANGUAGE_MAP },
  gutenberg: { fix_strategy: 'post_update (Gutenberg stores content as block HTML in post_content)', css_clear: 'no special CSS clearing', widgets: GUTENBERG_BLOCK_SCHEMAS, language_map: GUTENBERG_LANGUAGE_MAP },
};

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'get_schemas') {
      const builder_type = body.builder_type || 'elementor';
      const registry = BUILDER_SCHEMA_REGISTRY[builder_type] || BUILDER_SCHEMA_REGISTRY.elementor;
      return Response.json({ success: true, schemas: registry.widgets, language_map: registry.language_map, fix_strategy: registry.fix_strategy, css_clear: registry.css_clear });
    }

    if (action === 'match_template') {
      const { message } = body;
      const match = matchChangeTemplate(message);
      return Response.json(match || { matched: false });
    }

    if (action === 'get_context') {
      const builder_type = body.builder_type || 'elementor';
      const { message } = body;
      const registry = BUILDER_SCHEMA_REGISTRY[builder_type] || BUILDER_SCHEMA_REGISTRY.elementor;
      const match = matchChangeTemplate(message);
      return Response.json({ success: true, schemas: registry.widgets, language_map: registry.language_map, fix_strategy: registry.fix_strategy, css_clear: registry.css_clear, template_match: match });
    }

    if (action === 'list_builders') {
      return Response.json({ success: true, builders: Object.keys(BUILDER_SCHEMA_REGISTRY) });
    }

    if (action === 'list_widget_types') {
      const builder_type = body.builder_type || 'elementor';
      const registry = BUILDER_SCHEMA_REGISTRY[builder_type] || BUILDER_SCHEMA_REGISTRY.elementor;
      return Response.json({ success: true, widget_types: Object.keys(registry.widgets) });
    }

    return Response.json({ error: 'Invalid action. Use: get_schemas, match_template, get_context, list_builders, list_widget_types' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
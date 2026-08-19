use headless_chrome::{Browser, LaunchOptions};

use base64::{Engine as _, engine::general_purpose};

pub fn generate_pdf_from_html(
    html_content: &str, 
    paper_size: Option<String>, 
    landscape: Option<bool>
) -> Result<String, String> {
    log::info!("Starting PDF generation from HTML...");
    // Determine dimensions (in inches and pixels at 96 DPI)
    // A4: 8.27 x 11.69
    // A3: 11.69 x 16.54
    let paper_size_str = paper_size.clone().unwrap_or_else(|| "A4".to_string()).to_uppercase();
    let is_a3 = paper_size_str == "A3";
    let is_landscape = landscape.unwrap_or(false);

    let (width_in, height_in) = if is_a3 {
        if is_landscape { (16.54, 11.69) } else { (11.69, 16.54) }
    } else {
        if is_landscape { (11.69, 8.27) } else { (8.27, 11.69) }
    };

    // Calculate window size in pixels for the browser viewport
    let width_px = (width_in * 96.0) as u32;
    let height_px = (height_in * 96.0) as u32;

    log::info!("Launching browser (headless)...");
    let launch_options = LaunchOptions {
        headless: true,
        window_size: Some((width_px, height_px)),
        ..Default::default()
    };

    let browser = Browser::new(launch_options).map_err(|e| {
        log::error!("Failed to launch browser: {}", e);
        format!("Failed to launch browser: {}", e)
    })?;
    log::info!("Browser launched. Creating new tab...");
    
    let tab = browser.new_tab().map_err(|e| format!("Failed to create tab: {}", e))?;

    log::info!("Navigating to blank page...");
    tab.navigate_to("about:blank").map_err(|e| format!("Failed to nav to blank: {}", e))?;
    tab.wait_until_navigated().map_err(|e| format!("Failed to wait for nav: {}", e))?;

    log::info!("Injecting HTML content...");
    let encoded_html = general_purpose::STANDARD.encode(html_content);
    let js = format!(
        "document.open(); document.write(decodeURIComponent(escape(window.atob('{}')))); document.close();",
        encoded_html
    );
    
    tab.evaluate(&js, false).map_err(|e| format!("Failed to set HTML content: {}", e))?;

    // Wait a bit for layout to settle
    log::info!("Waiting for layout to settle (500ms)...");
    std::thread::sleep(std::time::Duration::from_millis(500));

    log::info!("Printing to PDF...");
    let pdf_options = headless_chrome::types::PrintToPdfOptions {
        landscape: Some(is_landscape),
        display_header_footer: Some(false),
        print_background: Some(true),
        scale: Some(1.0),
        paper_width: Some(width_in),
        paper_height: Some(height_in),
        margin_top: Some(0.0),
        margin_bottom: Some(0.0),
        margin_left: Some(0.0),
        margin_right: Some(0.0),
        page_ranges: None,
        ignore_invalid_page_ranges: None,
        header_template: None,
        footer_template: None,
        prefer_css_page_size: Some(true),
        transfer_mode: None,
        generate_document_outline: Some(false),
        generate_tagged_pdf: Some(false),
    };

    let pdf_data = tab.print_to_pdf(Some(pdf_options)).map_err(|e| {
        log::error!("Failed to print to PDF: {}", e);
        format!("Failed to print to PDF: {}", e)
    })?;

    log::info!("PDF generated successfully. Encoding to base64...");
    Ok(general_purpose::STANDARD.encode(&pdf_data))
}

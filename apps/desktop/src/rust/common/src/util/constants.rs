// Modified 2026 by Treslibre Project (Treslibre).
pub const BUILD_FLAVOR: &str = env!("THREEMA_BUILD_FLAVOR"); // e.g. consumer-sandbox or work-live

pub const VALID_BUILD_FLAVORS: [&str; 6] = [
    "consumer-sandbox",
    "consumer-live",
    "work-sandbox",
    "work-live",
    "work-onprem",
    "custom-onprem",
];

// Note: Keep this in sync with `determineAppName` in `base.js` unless for custom variant.
pub const fn determine_app_name() -> &'static str {
    // Compare as bytes to use `match` in `const fn`. See:
    // https://github.com/rust-lang/rust/issues/90237#issuecomment-1550885913.
    match BUILD_FLAVOR.as_bytes() {
        b"consumer-live"
        | b"consumer-sandbox"
        | b"work-live"
        | b"work-sandbox"
        | b"work-onprem"
        | b"custom-onprem" => "Treslibre",
        _other => {
            panic!("Invalid build flavor provided. This is a build configuration error, set the correct THREEMA_BUILD_FLAVOR env var when building!");
        }
    }
}

// Note: Keep this in sync with `determineAppRdn` in `base.js`.
pub const fn determine_app_rdn() -> &'static str {
    // Compare as bytes to use `match` in `const fn`. See:
    // https://github.com/rust-lang/rust/issues/90237#issuecomment-1550885913.
    match BUILD_FLAVOR.as_bytes() {
        b"consumer-live"
        | b"consumer-sandbox"
        | b"work-live"
        | b"work-sandbox"
        | b"work-onprem"
        | b"custom-onprem" => "org.treslibre.app.desktop",
        _other => {
            panic!("Invalid build flavor provided. This is a build configuration error, set the correct THREEMA_BUILD_FLAVOR env var when building!");
        }
    }
}

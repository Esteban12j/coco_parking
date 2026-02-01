// Barcode scanner capture via OS keyboard events.
// Pistol scanners act as HID keyboards: they type the code very fast and send Enter.
// We detect "scanner input" by timing: short burst of keys + Enter => emit to frontend.
// Data is only consumed by the scanner input on the vehicles page (no other field receives it).

use std::sync::Arc;
use std::time::{Duration, Instant};

use rdev::{Event, EventType, Key};
use tauri::{AppHandle, Emitter};

const MAX_SEQUENCE_MS: u64 = 800;
const MAX_GAP_MS: u64 = 50;
const MIN_BARCODE_LEN: usize = 2;

#[cfg_attr(test, derive(Debug))]
struct BarcodeState {
    buffer: String,
    first_ts: Option<Instant>,
    last_ts: Instant,
}

impl Default for BarcodeState {
    fn default() -> Self {
        Self {
            buffer: String::new(),
            first_ts: None,
            last_ts: Instant::now(),
        }
    }
}

fn is_enter(key: Key) -> bool {
    matches!(key, Key::Return | Key::KpReturn)
}

fn process_event(
    event: Event,
    state: &mut BarcodeState,
    now: Instant,
) -> Option<String> {
    let EventType::KeyPress(key) = event.event_type else {
        return None;
    };

    if is_enter(key) {
        if state.buffer.len() >= MIN_BARCODE_LEN {
            if let Some(first) = state.first_ts {
                if now.duration_since(first) < Duration::from_millis(MAX_SEQUENCE_MS) {
                    let barcode = std::mem::take(&mut state.buffer);
                    state.first_ts = None;
                    return Some(barcode);
                }
            }
        }
        state.buffer.clear();
        state.first_ts = None;
        return None;
    }

    if now.duration_since(state.last_ts) > Duration::from_millis(MAX_GAP_MS) {
        state.buffer.clear();
        state.first_ts = None;
    }

    if let Some(ref name) = event.name {
        if !name.is_empty() {
            state.buffer.push_str(name);
            state.first_ts.get_or_insert(now);
            state.last_ts = now;
        }
    }

    None
}

pub fn spawn_barcode_listener(handle: AppHandle) {
    let state = Arc::new(std::sync::Mutex::new(BarcodeState::default()));
    let state_clone = Arc::clone(&state);
    let handle = Arc::new(handle);

    std::thread::spawn(move || {
        let handle = Arc::clone(&handle);
        let state = Arc::clone(&state_clone);

        if let Err(e) = rdev::listen(move |event| {
            let now = Instant::now();
            let mut guard = state.lock().unwrap();
            if let Some(barcode) = process_event(event, &mut guard, now) {
                let _ = handle.emit("barcode-scanned", barcode);
            }
        }) {
            eprintln!("[scanner] rdev listen error: {:?}", e);
        }
    });
}

#[cfg(test)]
mod tests {
    use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

    use rdev::{Event, EventType, Key};

    use super::{process_event, BarcodeState};

    fn make_event(key: Key, name: Option<&str>) -> Event {
        Event {
            time: SystemTime::now(),
            name: name.map(str::to_string),
            event_type: EventType::KeyPress(key),
        }
    }

    #[test]
    fn process_event_enter_with_short_burst_emits_barcode() {
        let mut state = BarcodeState::default();
        let now = Instant::now();
        let e1 = make_event(Key::KeyA, Some("A"));
        assert!(process_event(e1, &mut state, now).is_none());
        let e2 = make_event(Key::KeyB, Some("B"));
        assert!(process_event(e2, &mut state, now).is_none());
        let e3 = make_event(Key::Return, None);
        let out = process_event(e3, &mut state, now);
        assert_eq!(out, Some("AB".to_string()));
    }

    #[test]
    fn process_event_enter_with_empty_buffer_returns_none() {
        let mut state = BarcodeState::default();
        let now = Instant::now();
        let e = make_event(Key::Return, None);
        assert!(process_event(e, &mut state, now).is_none());
    }

    #[test]
    fn process_event_single_char_then_enter_returns_none_min_length() {
        let mut state = BarcodeState::default();
        let now = Instant::now();
        let e1 = make_event(Key::Num1, Some("1"));
        process_event(e1, &mut state, now);
        let e2 = make_event(Key::Return, None);
        assert!(process_event(e2, &mut state, now).is_none());
    }

    #[test]
    fn process_event_enter_clears_buffer() {
        let mut state = BarcodeState::default();
        let now = Instant::now();
        process_event(make_event(Key::KeyA, Some("A")), &mut state, now);
        process_event(make_event(Key::Return, None), &mut state, now);
        let out = process_event(make_event(Key::Return, None), &mut state, now);
        assert!(out.is_none());
    }

    #[test]
    fn process_event_long_gap_clears_buffer_then_only_new_chars_remain() {
        let mut state = BarcodeState::default();
        let t0 = Instant::now();
        process_event(make_event(Key::KeyA, Some("A")), &mut state, t0);
        let t1 = t0 + Duration::from_millis(100);
        process_event(make_event(Key::KeyB, Some("B")), &mut state, t1);
        let out = process_event(make_event(Key::Return, None), &mut state, t1);
        assert!(out.is_none(), "buffer was cleared by gap so only 'B' remained (len 1 < MIN_BARCODE_LEN)");
    }
}

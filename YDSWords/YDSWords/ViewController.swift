import UIKit
import WebKit

class ViewController: UIViewController {
    
    // MARK: - Properties
    private var webView: WKWebView!
    private var activityIndicator: UIActivityIndicatorView!
    
    // MARK: - Streak Storage Keys (must match streak.js)
    private let streakKeys = [
        "yds_quiz_streak",
        "yds_flashcard_streak",
        "yds_quiz_progress",
        "yds_flashcard_progress",
        "yds_last_study_date",
        "yds_quiz_completed_today",
        "yds_flashcard_completed_today"
    ]
    
    // MARK: - Lifecycle
    override func viewDidLoad() {
        super.viewDidLoad()
        setupWebView()
        setupActivityIndicator()
        setupConstraints()
        loadLocalHTML()
    }
    

    
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        navigationController?.setNavigationBarHidden(true, animated: animated)
    }
    
    // MARK: - Setup
    private func setupWebView() {
        // Configure WKWebView
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        
        // Enable JavaScript
        configuration.preferences.javaScriptEnabled = true
        
        // Configure website data store for better network compatibility
        // Use non-persistent store to avoid caching issues on cellular
        configuration.websiteDataStore = WKWebsiteDataStore.default()
        
        // Configure process pool for shared state
        configuration.processPool = WKProcessPool()
        
        // Add JavaScript message handler for native storage bridge
        configuration.userContentController.add(self, name: "nativeStorage")
        
        // Create web view with iPhone 13 mini optimized frame
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.navigationDelegate = self
        webView.uiDelegate = self
        
        // Use system background color for automatic dark mode support
        webView.backgroundColor = .systemBackground
        webView.isOpaque = false
        
        // Handle safe area for iPhone notch
        webView.scrollView.contentInsetAdjustmentBehavior = .always
        
        // Use system background for scroll view to prevent flash
        webView.scrollView.backgroundColor = .systemBackground
        
        view.addSubview(webView)
    }
    
    private func setupActivityIndicator() {
        activityIndicator = UIActivityIndicatorView(style: .large)
        activityIndicator.translatesAutoresizingMaskIntoConstraints = false
        activityIndicator.color = .label
        activityIndicator.hidesWhenStopped = true
        view.addSubview(activityIndicator)
    }
    
    private func setupConstraints() {
        NSLayoutConstraint.activate([
            // WebView constraints - use safe area for iPhone 13 mini notch compatibility
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
            
            // Activity indicator - centered in safe area
            activityIndicator.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            activityIndicator.centerYAnchor.constraint(equalTo: view.safeAreaLayoutGuide.centerYAnchor)
        ])
    }
    
    // MARK: - Load Content
    private func loadLocalHTML() {
        activityIndicator.startAnimating()
        
        // Load index.html from app bundle
        guard let htmlUrl = Bundle.main.url(forResource: "index", withExtension: "html") else {
            print("index.html not found in bundle")
            showErrorAlert(message: "App files not found. Please reinstall the app.")
            activityIndicator.stopAnimating()
            return
        }
        
        // Allow access to the entire bundle directory to avoid sandbox issues
        let bundleUrl = Bundle.main.bundleURL
        
        // Use loadFileURL with allowingReadAccessTo: bundleUrl for proper sandbox handling
        webView.loadFileURL(htmlUrl, allowingReadAccessTo: bundleUrl)
    }
    
    // MARK: - Native Storage Bridge
    
    /// Save streak data to UserDefaults (persistent across app restarts)
    private func saveStreakData(key: String, value: String) {
        UserDefaults.standard.set(value, forKey: key)
        print("[NativeStorage] Saved \(key)")
    }
    
    /// Load streak data from UserDefaults
    private func loadStreakData(key: String) -> String? {
        let value = UserDefaults.standard.string(forKey: key)
        print("[NativeStorage] Loaded \(key): \(value != nil ? "found" : "not found")")
        return value
    }
    
    /// Migrate existing data from localStorage to UserDefaults (one-time)
    private func migrateFromLocalStorage() {
        // This is called from JavaScript when app loads
        // JavaScript will send localStorage data if it exists
        print("[NativeStorage] Migration check complete")
    }
    
    // MARK: - Error Handling
    private func showErrorAlert(message: String) {
        let alert = UIAlertController(
            title: "Error",
            message: message,
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "Retry", style: .default) { [weak self] _ in
            self?.loadLocalHTML()
        })
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        present(alert, animated: true)
    }
}

// MARK: - WKScriptMessageHandler (Native Storage Bridge)
extension ViewController: WKScriptMessageHandler {
    
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "nativeStorage" else { return }
        
        // Parse message body
        guard let body = message.body as? [String: Any],
              let action = body["action"] as? String else {
            print("[NativeStorage] Invalid message format")
            return
        }
        
        switch action {
        case "save":
            if let key = body["key"] as? String,
               let value = body["value"] as? String {
                saveStreakData(key: key, value: value)
                
                // Send success callback to JavaScript
                let callback = body["callback"] as? String ?? ""
                if !callback.isEmpty {
                    let js = "\(callback)(true)"
                    webView.evaluateJavaScript(js, completionHandler: nil)
                }
            }
            
        case "load":
            if let key = body["key"] as? String {
                let value = loadStreakData(key: key) ?? ""
                
                // Send value back to JavaScript via callback
                let callback = body["callback"] as? String ?? ""
                if !callback.isEmpty {
                    let escapedValue = value.replacingOccurrences(of: "'", with: "\\'")
                                           .replacingOccurrences(of: "\"", with: "\\\"")
                                           .replacingOccurrences(of: "\n", with: "\\n")
                    let js = "\(callback)(\"\(escapedValue)\")"
                    webView.evaluateJavaScript(js, completionHandler: nil)
                }
            }
            
        case "loadAll":
            // Load all streak data at once
            var allData: [String: String] = [:]
            for key in streakKeys {
                if let value = UserDefaults.standard.string(forKey: key) {
                    allData[key] = value
                }
            }
            
            // Send back to JavaScript
            if let callback = body["callback"] as? String, !callback.isEmpty {
                do {
                    let jsonData = try JSONSerialization.data(withJSONObject: allData)
                    if let jsonString = String(data: jsonData, encoding: .utf8) {
                        let js = "\(callback)(\(jsonString))"
                        webView.evaluateJavaScript(js, completionHandler: nil)
                    }
                } catch {
                    print("[NativeStorage] Error serializing data: \(error)")
                }
            }
            
        case "clear":
            // Clear all streak data (for testing)
            for key in streakKeys {
                UserDefaults.standard.removeObject(forKey: key)
            }
            print("[NativeStorage] All streak data cleared")
            
        default:
            print("[NativeStorage] Unknown action: \(action)")
        }
    }
}

// MARK: - WKNavigationDelegate
extension ViewController: WKNavigationDelegate {
    
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        // Page started loading
    }
    
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        // Page finished loading
        activityIndicator.stopAnimating()
    }
    
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        activityIndicator.stopAnimating()
        print("Navigation failed: \(error)")
        print("Error code: \(error._code)")
        print("Error domain: \(error._domain)")
    }
    
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        activityIndicator.stopAnimating()
        print("Provisional navigation failed: \(error)")
        print("Error code: \(error._code)")
        print("Error domain: \(error._domain)")
        
        // Log specific error information for debugging
        let nsError = error as NSError
        print("Error user info: \(nsError.userInfo)")
    }
    
    // Handle link clicks and external URLs
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        
        if let url = navigationAction.request.url {
            // Allow local file navigation
            if url.isFileURL {
                decisionHandler(.allow)
                return
            }
            
            // For external links (like API calls), allow them
            if url.scheme == "https" || url.scheme == "http" {
                decisionHandler(.allow)
                return
            }
        }
        
        decisionHandler(.allow)
    }
    
    // Handle authentication challenges (needed for some cellular networks)
    func webView(_ webView: WKWebView, didReceive challenge: URLAuthenticationChallenge, completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
        // Accept all certificates (needed for some corporate/cellular networks)
        if let serverTrust = challenge.protectionSpace.serverTrust {
            let credential = URLCredential(trust: serverTrust)
            completionHandler(.useCredential, credential)
        } else {
            completionHandler(.performDefaultHandling, nil)
        }
    }
}

// MARK: - WKUIDelegate
extension ViewController: WKUIDelegate {
    
    // Handle JavaScript alerts
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in
            completionHandler()
        })
        present(alert, animated: true)
    }
    
    // Handle JavaScript confirm dialogs
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in
            completionHandler(true)
        })
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in
            completionHandler(false)
        })
        present(alert, animated: true)
    }
    
    // Handle JavaScript text input prompts
    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        let alert = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
        alert.addTextField { textField in
            textField.text = defaultText
        }
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in
            completionHandler(alert.textFields?.first?.text)
        })
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in
            completionHandler(nil)
        })
        present(alert, animated: true)
    }
}

import UIKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = (scene as? UIWindowScene) else { return }
        
        // Create window
        window = UIWindow(windowScene: windowScene)
        
        // Create root view controller
        let viewController = ViewController()
        let navigationController = UINavigationController(rootViewController: viewController)
        navigationController.isNavigationBarHidden = true
        
        window?.rootViewController = navigationController
        window?.makeKeyAndVisible()
        
        // Configure appearance
        configureAppearance()
    }

    func configureAppearance() {
        let appearance = UINavigationBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor = UIColor(red: 0.992, green: 0.984, blue: 0.969, alpha: 1.0) // #fdfbf7
        appearance.titleTextAttributes = [.foregroundColor: UIColor(red: 0.118, green: 0.161, blue: 0.231, alpha: 1.0)]
        UINavigationBar.appearance().standardAppearance = appearance
        UINavigationBar.appearance().scrollEdgeAppearance = appearance
    }

    func sceneDidDisconnect(_ scene: UIScene) {
        // Called when the scene is being released by the system
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        // Called when the scene has moved from an inactive state to an active state
    }

    func sceneWillResignActive(_ scene: UIScene) {
        // Called when the scene will move from an active state to an inactive state
    }

    func sceneWillEnterForeground(_ scene: UIScene) {
        // Called as the scene transitions from the background to the foreground
    }

    func sceneDidEnterBackground(_ scene: UIScene) {
        // Called as the scene transitions from the foreground to the background
    }
}

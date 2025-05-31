<?php
ini_set('display_errors', 1); // For development
error_reporting(E_ALL);     // For development

session_start();
require_once 'db_config.php'; // $pdo is available here

header('Content-Type: application/json');

$response = ['success' => false, 'message' => 'Invalid request'];

// Constants for affiliate programs
define('AMAZON_AFFILIATE_TAG', 'arghade4102h-21');
define('EARNKARO_API_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2ODJjODJkNmEyMzdmM2FjYWY5Y2U5NjYiLCJlYXJua2FybyI6IjQzMTEwNjgiLCJpYXQiOjE3NDg0NDk0MDl9.eRjBk3hEF_wOl5by6aDo4zcLYYQLoyjA9hKhcN7LsHw');

if (isset($_POST['action'])) {
    $action = $_POST['action'];

    try {
        switch ($action) {
            case 'register':
                // Input validation
                if (empty($_POST['username']) || empty($_POST['email']) || empty($_POST['password'])) {
                    $response['message'] = 'All fields are required.';
                    break;
                }
                if (!filter_var($_POST['email'], FILTER_VALIDATE_EMAIL)) {
                    $response['message'] = 'Invalid email format.';
                    break;
                }
                if (strlen($_POST['password']) < 6) {
                    $response['message'] = 'Password must be at least 6 characters.';
                    break;
                }

                $username = trim($_POST['username']);
                $email = trim($_POST['email']);
                $password_hash = password_hash($_POST['password'], PASSWORD_DEFAULT);

                // Check if username or email already exists
                $stmt = $pdo->prepare("SELECT id FROM users WHERE username = :username OR email = :email");
                $stmt->execute(['username' => $username, 'email' => $email]);
                if ($stmt->fetch()) {
                    $response['message'] = 'Username or Email already exists.';
                    break;
                }

                $stmt = $pdo->prepare("INSERT INTO users (username, email, password_hash) VALUES (:username, :email, :password_hash)");
                if ($stmt->execute(['username' => $username, 'email' => $email, 'password_hash' => $password_hash])) {
                    $response = ['success' => true, 'message' => 'Registration successful.'];
                } else {
                    $response['message'] = 'Registration failed. Please try again.';
                }
                break;

            case 'login':
                if (empty($_POST['username']) || empty($_POST['password'])) {
                    $response['message'] = 'Username/Email and Password are required.';
                    break;
                }
                $login_identifier = trim($_POST['username']); // Can be username or email
                $password = $_POST['password'];

                $stmt = $pdo->prepare("SELECT id, username, email, password_hash, role, total_points FROM users WHERE username = :identifier OR email = :identifier");
                $stmt->execute(['identifier' => $login_identifier]);
                $user = $stmt->fetch();

                if ($user && password_verify($password, $user['password_hash'])) {
                    $_SESSION['user_id'] = $user['id'];
                    $_SESSION['username'] = $user['username'];
                    $_SESSION['role'] = $user['role'];
                    $response = [
                        'success' => true,
                        'message' => 'Login successful.',
                        'user' => [
                            'id' => $user['id'],
                            'username' => $user['username'],
                            'email' => $user['email'],
                            'role' => $user['role'],
                            'total_points' => $user['total_points']
                        ]
                    ];
                } else {
                    $response['message'] = 'Invalid username/email or password.';
                }
                break;

            case 'logout':
                session_unset();
                session_destroy();
                $response = ['success' => true, 'message' => 'Logged out successfully.'];
                break;

            case 'check_session':
                if (isset($_SESSION['user_id'])) {
                    $stmt = $pdo->prepare("SELECT id, username, email, role, total_points FROM users WHERE id = :id");
                    $stmt->execute(['id' => $_SESSION['user_id']]);
                    $user = $stmt->fetch();
                    if ($user) {
                        $response = [
                            'success' => true,
                            'loggedIn' => true,
                            'user' => $user
                        ];
                    } else {
                         $response = ['success' => false, 'loggedIn' => false, 'message' => 'User not found in session.'];
                         session_unset(); session_destroy(); // Clean up bad session
                    }
                } else {
                    $response = ['success' => true, 'loggedIn' => false];
                }
                break;

            // USER SPECIFIC ACTIONS (REQUIRE LOGIN)
            case 'get_profile_data':
                if (!isset($_SESSION['user_id'])) {
                    $response['message'] = 'Unauthorized. Please login.'; break;
                }
                $user_id = $_SESSION['user_id'];
                $stmt = $pdo->prepare("SELECT username, email, total_points FROM users WHERE id = :id");
                $stmt->execute(['id' => $user_id]);
                $userData = $stmt->fetch();

                $stmt_links = $pdo->prepare("SELECT COUNT(*) as count FROM generated_links WHERE user_id = :user_id");
                $stmt_links->execute(['user_id' => $user_id]);
                $links_count = $stmt_links->fetchColumn();

                $stmt_orders_succ = $pdo->prepare("SELECT COUNT(*) as count FROM orders WHERE user_id = :user_id AND status = 'approved'");
                $stmt_orders_succ->execute(['user_id' => $user_id]);
                $successful_orders_count = $stmt_orders_succ->fetchColumn();

                $stmt_orders_pend = $pdo->prepare("SELECT COUNT(*) as count FROM orders WHERE user_id = :user_id AND status = 'pending'");
                $stmt_orders_pend->execute(['user_id' => $user_id]);
                $pending_orders_count = $stmt_orders_pend->fetchColumn();

                if ($userData) {
                    $response = [
                        'success' => true,
                        'data' => [
                            'username' => $userData['username'],
                            'email' => $userData['email'],
                            'total_points' => $userData['total_points'],
                            'links_created_count' => $links_count,
                            'successful_orders_count' => $successful_orders_count,
                            'pending_orders_count' => $pending_orders_count
                        ]
                    ];
                } else {
                    $response['message'] = 'User data not found.';
                }
                break;

            case 'generate_link':
                if (!isset($_SESSION['user_id'])) {
                    $response['message'] = 'Unauthorized. Please login.'; break;
                }
                if (empty($_POST['original_url'])) {
                    $response['message'] = 'Original URL is required.'; break;
                }
                $original_url = trim($_POST['original_url']);
                if (!filter_var($original_url, FILTER_VALIDATE_URL)) {
                     $response['message'] = 'Invalid URL format.'; break;
                }

                $user_id = $_SESSION['user_id'];
                $affiliate_url = '';
                $platform = '';

                // Check if Amazon link
                if (preg_match('/(amazon\.in|amzn\.to|amazon\.com)/i', $original_url)) {
                    $platform = 'amazon';
                    if (strpos($original_url, '?') === false) {
                        $affiliate_url = $original_url . '?tag=' . AMAZON_AFFILIATE_TAG;
                    } else {
                        $affiliate_url = $original_url . '&tag=' . AMAZON_AFFILIATE_TAG;
                    }
                } else { // Earnkaro for others (Flipkart, Ajio, Myntra, Nykaa, Shopsy, etc.)
                    $platform = 'earnkaro';
                    $curl = curl_init();
                    curl_setopt_array($curl, array(
                        CURLOPT_URL => 'https://ekaro-api.affiliaters.in/api/converter/public',
                        CURLOPT_RETURNTRANSFER => true,
                        CURLOPT_ENCODING => '',
                        CURLOPT_MAXREDIRS => 10,
                        CURLOPT_TIMEOUT => 30, // Set timeout
                        CURLOPT_FOLLOWLOCATION => true,
                        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
                        CURLOPT_CUSTOMREQUEST => 'POST',
                        CURLOPT_POSTFIELDS => json_encode([
                            "deal" => $original_url,
                            "convert_option" => "convert_only"
                        ]),
                        CURLOPT_HTTPHEADER => array(
                            'Authorization: Bearer ' . EARNKARO_API_KEY,
                            'Content-Type: application/json'
                        ),
                    ));
                    $api_response_raw = curl_exec($curl);
                    $http_code = curl_getinfo($curl, CURLINFO_HTTP_CODE);
                    $curl_error = curl_error($curl);
                    curl_close($curl);

                    if ($curl_error) {
                        $response['message'] = "Earnkaro API cURL Error: " . $curl_error;
                        break;
                    }

                    if ($http_code == 200 || $http_code == 201) {
                        $api_response = json_decode($api_response_raw, true);

                        if (is_array($api_response)) {
                            // *** THIS IS THE CORRECTED LOGIC based on your error message ***
                            if (isset($api_response['success']) && ($api_response['success'] == 1 || $api_response['success'] === true) && isset($api_response['data']) && is_string($api_response['data'])) {
                                // The API response indicates success, and 'data' holds the converted URL string.
                                $affiliate_url = $api_response['data'];
                            }
                            // Fallback checks for other possible Earnkaro response structures
                            elseif (isset($api_response['converted_url']) && is_string($api_response['converted_url'])) {
                                $affiliate_url = $api_response['converted_url'];
                            } elseif (isset($api_response['data']) && is_array($api_response['data']) && isset($api_response['data']['converted_url']) && is_string($api_response['data']['converted_url'])) {
                                 $affiliate_url = $api_response['data']['converted_url'];
                            } else {
                                // If none of the expected structures match
                                $response['message'] = 'Earnkaro API: Could not find converted URL in the expected format. Response was: ' . htmlspecialchars($api_response_raw);
                                error_log("Earnkaro API - Unexpected successful response structure: " . $api_response_raw);
                                break; // Stop processing this request
                            }
                        } else {
                            // JSON decoding failed or the response was not an array
                            $response['message'] = 'Earnkaro API: Invalid JSON response received. Raw: ' . htmlspecialchars($api_response_raw);
                            error_log("Earnkaro API - Invalid JSON: " . $api_response_raw);
                            break; // Stop processing this request
                        }
                    } else {
                         // HTTP error from Earnkaro API
                         $response['message'] = "Earnkaro API Error: HTTP " . $http_code . " - Response: " . htmlspecialchars($api_response_raw);
                         error_log("Earnkaro API - HTTP Error " . $http_code . ": " . $api_response_raw);
                         break; // Stop processing this request
                    }
                }

                if (!empty($affiliate_url)) {
                    $stmt = $pdo->prepare("INSERT INTO generated_links (user_id, original_url, affiliate_url, platform) VALUES (:user_id, :original_url, :affiliate_url, :platform)");
                    if ($stmt->execute([
                        'user_id' => $user_id,
                        'original_url' => $original_url,
                        'affiliate_url' => $affiliate_url,
                        'platform' => $platform
                        ])) {
                        // If everything is successful, set success to true and provide the URL
                        $response = ['success' => true, 'affiliate_url' => $affiliate_url, 'platform' => $platform];
                    } else {
                        $response['message'] = 'Failed to save generated link to database.';
                        // success remains false from initialization
                    }
                } elseif (empty($response['message'])) {
                    // This case would happen if $affiliate_url is empty but no specific error message was set above.
                    // This ensures $response['success'] is false if no URL was generated and no other error occurred.
                    $response['message'] = 'Affiliate link could not be generated (empty result from API or processing).';
                    // success remains false
                }
                // If $response['message'] was set by a 'break' earlier, $response['success'] is already false.
                break;

            case 'submit_order_evidence':
                if (!isset($_SESSION['user_id'])) {
                    $response['message'] = 'Unauthorized. Please login.'; break;
                }
                if (empty($_POST['order_id_external']) || empty($_POST['purchase_amount'])) {
                    $response['message'] = 'Order ID and Purchase Amount are required.'; break;
                }

                $user_id = $_SESSION['user_id'];
                $order_id_external = trim($_POST['order_id_external']);
                $purchase_amount = filter_var($_POST['purchase_amount'], FILTER_VALIDATE_FLOAT);

                if ($purchase_amount === false || $purchase_amount <= 0) {
                     $response['message'] = 'Invalid purchase amount.'; break;
                }

                $stmt = $pdo->prepare("INSERT INTO orders (user_id, order_id_external, purchase_amount, telegram_username) VALUES (:user_id, :order_id_external, :purchase_amount, (SELECT username FROM users WHERE id = :user_id_for_telegram))");
                if ($stmt->execute([
                    'user_id' => $user_id,
                    'order_id_external' => $order_id_external,
                    'purchase_amount' => $purchase_amount,
                    'user_id_for_telegram' => $user_id
                ])) {
                    $response = ['success' => true, 'message' => 'Order evidence submitted. It will be reviewed.'];
                } else {
                    $response['message'] = 'Failed to submit order evidence.';
                }
                break;

            case 'get_user_links':
                if (!isset($_SESSION['user_id'])) {
                    $response['message'] = 'Unauthorized. Please login.'; break;
                }
                $stmt = $pdo->prepare("SELECT original_url, affiliate_url, platform, created_at FROM generated_links WHERE user_id = :user_id ORDER BY created_at DESC");
                $stmt->execute(['user_id' => $_SESSION['user_id']]);
                $links = $stmt->fetchAll();
                $response = ['success' => true, 'links' => $links];
                break;

            case 'get_user_orders':
                 if (!isset($_SESSION['user_id'])) {
                    $response['message'] = 'Unauthorized. Please login.'; break;
                }
                $stmt = $pdo->prepare("SELECT order_id_external, purchase_amount, status, submitted_at, admin_notes FROM orders WHERE user_id = :user_id ORDER BY submitted_at DESC");
                $stmt->execute(['user_id' => $_SESSION['user_id']]);
                $orders = $stmt->fetchAll();
                $response = ['success' => true, 'orders' => $orders];
                break;

            case 'request_withdrawal':
                if (!isset($_SESSION['user_id'])) {
                    $response['message'] = 'Unauthorized. Please login.'; break;
                }
                if (empty($_POST['points_withdrawn']) || empty($_POST['withdrawal_details'])) {
                    $response['message'] = 'Points and withdrawal details are required.'; break;
                }

                $user_id = $_SESSION['user_id'];
                $points_to_withdraw = filter_var($_POST['points_withdrawn'], FILTER_VALIDATE_INT);
                $withdrawal_details = trim($_POST['withdrawal_details']);

                if ($points_to_withdraw === false || $points_to_withdraw <= 0) {
                    $response['message'] = 'Invalid points amount.'; break;
                }

                $stmt_user = $pdo->prepare("SELECT total_points FROM users WHERE id = :user_id");
                $stmt_user->execute(['user_id' => $user_id]);
                $user_points = $stmt_user->fetchColumn();

                if ($user_points < $points_to_withdraw) {
                    $response['message'] = 'Insufficient points for withdrawal.'; break;
                }

                $pdo->beginTransaction();
                $stmt = $pdo->prepare("INSERT INTO withdrawals (user_id, points_withdrawn, withdrawal_details, status) VALUES (:user_id, :points_withdrawn, :withdrawal_details, 'pending')");
                if ($stmt->execute([
                    'user_id' => $user_id,
                    'points_withdrawn' => $points_to_withdraw,
                    'withdrawal_details' => $withdrawal_details
                ])) {
                    $pdo->commit();
                    $response = ['success' => true, 'message' => 'Withdrawal request submitted.'];
                } else {
                    $pdo->rollBack();
                    $response['message'] = 'Failed to submit withdrawal request.';
                }
                break;

            case 'get_user_withdrawals':
                if (!isset($_SESSION['user_id'])) {
                    $response['message'] = 'Unauthorized. Please login.'; break;
                }
                $stmt = $pdo->prepare("SELECT points_withdrawn, status, withdrawal_details, requested_at, processed_at, admin_notes FROM withdrawals WHERE user_id = :user_id ORDER BY requested_at DESC");
                $stmt->execute(['user_id' => $_SESSION['user_id']]);
                $withdrawals = $stmt->fetchAll();
                $response = ['success' => true, 'withdrawals' => $withdrawals];
                break;

            default:
                $response['message'] = 'Unknown action.';
                break;
        }
    } catch (PDOException $e) {
        if (isset($pdo) && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log("PDO Error in api.php: " . $e->getMessage());
        $response['message'] = 'Database error occurred.';
    } catch (Exception $e) {
        if (isset($pdo) && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log("General Error in api.php: " . $e->getMessage());
        $response['message'] = 'An unexpected error occurred.';
    }
}

echo json_encode($response);
?>
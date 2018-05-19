<?php
$code = $_GET["code"];

//connect
$conn = mysqli_connect("localhost", "csfaculty", "ARSNova@", "pme");
if (!$conn) {die("Connection failed: " . mysqli_connect_error());}

$sql = "SELECT code FROM code_editor WHERE id = '$code'";
$result = mysqli_query($conn, $sql);

if (mysqli_num_rows($result) > 0) {
    // output data of each row
    while($row = mysqli_fetch_assoc($result)) {
        echo base64_decode($row["code"]); 
    }
} else {
    echo "0 results";
}

mysqli_close($conn);
?>

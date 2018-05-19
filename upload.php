<?php 
$code = $_POST["code"];
$id = uniqid(rand());
?>

<form id="form" method="GET" action="view.php"><input id="code" name="code"></form>

<script>
	function view(){
		document.getElementById("code").value = "<?php echo $id?>";
		document.getElementById("form").submit();
	};
</script>

<?php

//connect
$conn = mysqli_connect("localhost", "csfaculty", "ARSNova@", "pme");
if (!$conn) {die("Connection failed: " . mysqli_connect_error());}

$sql = "INSERT INTO code_editor (id, code) VALUES ('$id', '$code')";

if ($conn->query($sql) === TRUE) {
    echo "Redirecting... <br><br>";
	echo '<script>view();</script>';
} else {
	echo "Error: " . $sql . "<br>" . mysqli_error($conn);
    //echo "An error occured in the system. Please try again later after some time. <br><br>";
}

mysqli_close($conn);
?>
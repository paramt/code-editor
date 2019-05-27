
	/** editor **/
	var editor = CodeMirror.fromTextArea(document.getElementById("editor"), {
		mode: "text/html",
    theme: "default",
    lineNumbers: true,
		extraKeys: {"Ctrl-Space":"autocomplete", "Ctrl-J": "toMatchingTag"},
		indentUnit: 4,
		autoCloseTags: true,
		autoCloseBrackets: true,
		matchTags: {bothTags: true},
		foldGutter: true,
		gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter", "CodeMirror-lint-markers"],
		lint: true,

	});

	function loadCode(){
		if(localStorage.getItem("html") === null && localStorage.getItem("css") === null && localStorage.getItem("js") === null){
			editor.setValue("<html>\n\t<head>\n\t\t<title>My First Project!</title>\n\t</head>\n\n\t<body>\n\t\t\n\t</body>\n</html>");
			localStorage.setItem("html","<html>\n\t<head>\n\t\t<title>My First Project!</title>\n\t</head>\n\n\t<body>\n\t\t\n\t</body>\n</html>");
			localStorage.setItem("js","var num = 2;\nvar string = \"some text\";\nvar array = [42, 11, -13, 14];\n\nfunction myFunction(){\n\t\n}");
			localStorage.setItem("css","element-selector{\n\t\n}\n\n.class-selector{\n\t\n}\n\n#id-selector{\n\t\n}");
		} else {
			editor.setValue(localStorage.getItem("html"));
		}

		var frame = result.contentWindow.document;
		frame.open();
		frame.writeln(localStorage.getItem("html") + "\<style\>" + localStorage.getItem("css") + "\</style\> \<script\>" + localStorage.getItem("js") + "\</script\>");
		frame.close();

		compile();
	};

	function modeChange(){
		if(document.getElementById("mode").value == "js"){
			editor.setOption("mode", "javascript");
			editor.setValue(localStorage.getItem("js"));
		} else if(document.getElementById("mode").value == "css"){
			editor.setOption("mode", "css");
			editor.setValue(localStorage.getItem("css"));
		} else if(document.getElementById("mode").value == "html"){
			editor.setOption("mode", "text/html");
			editor.setValue(localStorage.getItem("html"));
		}
	}

	editor.setSize((window.innerWidth/2)-50, window.innerHeight-250);

	function resize(){
		editor.setSize((window.innerWidth/2)-50, window.innerHeight-250);
		var result = document.getElementById("result");
		result.style.width = window.innerWidth/2 + "px";
		result.style.height = window.innerHeight-250 + "px";
	}

	/** result **/
	var result = document.getElementById("result");
	result.style.width = window.innerWidth/2 + "px";
	result.style.height = window.innerHeight-250 + "px";

	function compile() {
		var frame = result.contentWindow.document;

		document.body.onkeyup = function(){
			if(document.getElementById("mode").value == "js"){
				localStorage.setItem("js", editor.getValue());
			} else if(document.getElementById("mode").value == "css"){
				localStorage.setItem("css", editor.getValue());
			} else if(document.getElementById("mode").value == "html"){
				localStorage.setItem("html", editor.getValue());
			}

			frame.open();
			frame.writeln(localStorage.getItem("html") + "\<style\>" + localStorage.getItem("css") + "</style> \<script\>" + localStorage.getItem("js") + "\</script\>");
			frame.close();
		};
	};

	function closePopup(){
		document.getElementsByClassName("popup-wrapper")[0].style.visibility = "hidden";
		document.getElementsByClassName("popup-wrapper")[0].style.opacity = "0";
		document.getElementsByClassName("CodeMirror-vscrollbar")[0].style.visibility = "visible";
	}

	function getCode(){
		// Get long-url
		var http = new XMLHttpRequest();
		var url = 'https://thakkaha.dev.fast.sheridanc.on.ca/pme/code-editor/api/upload.php';
		var params = 'code=' + window.btoa(localStorage.getItem("html") + "\<style\>" + localStorage.getItem("css") + "\</style\> \<script\>" + localStorage.getItem("js") + "\</script\>");
		http.open('POST', url, true);

		//Send the proper header information along with the request
		http.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');

		http.onload = function() {
	    if(http.readyState == 4 && http.status == 200) {
				// Shorten url
				url = 'https://thakkaha.dev.fast.sheridanc.on.ca/pme/1pt/add-url-to-db.php?url=' + "https://thakkaha.dev.fast.sheridanc.on.ca/pme/code-editor/api/view.php?code=" + http.responseText;
				http.open('GET', url, true);

				http.onload = function() {
					if(http.readyState == 4 && http.status == 200) {
						document.getElementsByClassName("popup-wrapper")[0].style.visibility = "visible";
						document.getElementsByClassName("popup-wrapper")[0].style.opacity = "1";
						document.getElementById("short-link").href = "https://1pt.co/" + http.responseText;
						document.getElementById("short-link").innerHTML = "www.1pt.co/" + http.responseText;
						document.getElementsByClassName("CodeMirror-vscrollbar")[0].style.visibility = "hidden";
					}
				}

				http.send();
	    }
		}

		http.send(params);
	}

	function resetCode(){
		if (confirm("Are you sure you want to reset all code? You will lose your work and won't be able to undo it.")){
			editor.setValue("<html>\n\t<head>\n\t\t<title>My First Project!</title>\n\t</head>\n\n\t<body>\n\t\t\n\t</body>\n</html>");
			localStorage.setItem("html","<html>\n\t<head>\n\t\t<title>My First Project!</title>\n\t</head>\n\n\t<body>\n\t\t\n\t</body>\n</html>");
			localStorage.setItem("js","var num = 2;\nvar string = \"some text\";\nvar array = [42, 11, -13, 14];\n\nfunction myFunction(){\n\t\n}");
			localStorage.setItem("css","element-selector{\n\t\n}\n\n.class-selector{\n\t\n}\n\n#id-selector{\n\t\n}");
			document.getElementById("mode").value = "html";
			editor.setOption("mode", "text/html");
		}
    }

// Function to download data to a file
function download(data, filename, type) {
    var file = new Blob([data], {type: type});
    if (window.navigator.msSaveOrOpenBlob) // IE10+
        window.navigator.msSaveOrOpenBlob(file, filename);
    else { // Others
        var a = document.createElement("a"),
                url = URL.createObjectURL(file);
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(function() {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 0);
    }
}

$(document).keydown(function(e){
	//CTRL + S keydown combo
	if(e.ctrlKey && e.keyCode == 83){
		event.preventDefault();
		var title = prompt("What would you like to title your project?", "MyProject");
		if (title === null) {
			return;
		};
		download(localStorage.getItem("html") + "\<style\>" + localStorage.getItem("css") + "\</style\> \<script\>" + localStorage.getItem("js") + "\</script\>", title+".html", "html");

	}
	if(e.ctrlKey && e.keyCode == 65){
		event.preventDefault();
		document.getElementById("editor").execCommand("selectAll");
	}
})

	function hideLoadingBar(){
		document.getElementById("spinner").style.filter = "opacity(0)";
		document.getElementById("spinner").style.opacity = "0";
		document.getElementById("spinnerOverlay").style.filter = "opacity(0)";
		document.getElementById("spinnerOverlay").style.opacity = "0";
		document.getElementById("spinnerOverlay").style.zIndex = "-1";

		document.getElementById("smallScreenTitle").className = "animated fadeInDown small title scroll-resize animation-no-delay";
		document.getElementById("smallScreenSubtitle").className = "animated fadeInLeft small light subtitle animation-delay-500";
		window.setTimeout(function(){document.body.style.overflow = "auto";}, 2000);
	}

	function showInfo(){
		document.getElementById("main").className = ("animated fadeOutUp");
		document.getElementById("info").style.display = "block";
	}

	function hideInfo(){
		document.getElementById("info").className = ("animated fadeOutLeft");
		document.body.style.backgroundColor = "#00167a";
		window.setTimeout(function(){location.reload();}, 1000);
	}

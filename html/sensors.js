/*
        This is code adapted from this blog post:
        https://auxenta.com/blog_User_Authentication_and_Authorization_with_AWS_Cognito.php

        Primarily designed and written by Suminda De Silva
        Reframed by Adam Rice for Skroot Labs Inc.
        */


// AWS IDs
// var userPoolId = 'us-east-2_2Yp5dOApk';
// var clientId = '6cbstoshp6a3r66vghh593c0b';
// var region = 'us-east-2';
// var identityPoolId = 'us-east-2:0c3799ba-af33-4541-b3db-e5e9fb509877';

var userPoolId = 'us-east-2_GfASc6bnY';
var clientId = '1t46ujgd3tl59vtutuvkmnah53';
var region = 'us-east-2';
var identityPoolId = 'us-east-2:d1ff2dd9-319a-4a15-af35-c60b1e0f088a';

// other variables
var cognitoUser;
var idToken;
var userPool;

// cognito user pool data object
var poolData = {
  UserPoolId: userPoolId,
  ClientId: clientId
};


var docClient;
var tableName = "SkrootSensorTables";
var tableNamesStored;
var readingsBeingDisplayed;
var timesBeingDisplayed;
var displayChart;

switchToRegisterView();
getCurrentLoggedInSession();

function hideAll() {
  tellUser("");
  $("#registerView").hide();
  $("#verificationView").hide();
  $("#signInView").hide();
  $("#loggedInView").hide();
  clearChart(displayChart);
}

function switchToSignInView() {
  hideAll();
  $("#signInView").show();
}

function switchToRegisterView() {
  hideAll();
  $("#registerView").show();
}

function switchToVerificationView() {
  hideAll();
  $("#verificationView").show();
}

function switchToLoggedInView() {
  hideAll();
  $("#loggedInView").show();
  var element = document.getElementById("head");
  element.innerHTML = "All Results"
  docClient = new AWS.DynamoDB.DocumentClient();
}


/// LOG IN AND OUT ///

function logOut() {
  if (cognitoUser != null) {
    switchToSignInView();
    cognitoUser.signOut();
    tellUser('Logged out!');
    var element = document.getElementById("head");
    element.innerHTML = ""
    var element = document.getElementById("")
    deleteOldCharts2()
    deleteOldButtons2()
  }
}

function logIn() {

  if (!$('#usernameInput').val() || !$('#passwordInput').val()) {
    tellUser('Please enter Username and Password!');
  } else {
    tellUser("Logging in...");
    var authenticationData = {
      Username: $('#usernameInput').val(),
      Password: $("#passwordInput").val(),
    };
    var authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails(authenticationData);

    var userData = {
      Username: $('#usernameInput').val(),
      Pool: userPool
    };
    cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

    cognitoUser.authenticateUser(authenticationDetails, {
      onSuccess: function(result) {
        tellUser('Logged in!');

        $("#accessDataButton").hide();
        switchToLoggedInView();
        idToken = result.getIdToken().getJwtToken();
        getCognitoIdentityCredentials();
        var FullAttribute = result.getIdToken()
      },

      onFailure: function(err) {
        tellUser(err.message);
      },

    });
  }
}


// If user has logged in before, get the previous session so user doesn't need to log in again.
function getCurrentLoggedInSession() {

  tellUser("Loading...");
  userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
  cognitoUser = userPool.getCurrentUser();
  if (cognitoUser != null) {
    cognitoUser.getSession(function(err, session) {
      if (err) {
        tellUser(err.message);
      } else {
        tellUser('Logged in.');
        idToken = session.getIdToken().getJwtToken();
        switchToLoggedInView();
        getCognitoIdentityCredentials();

        //const ReaderID = currentUserInfo.attributes['custom:SensorID']
        //const StartDate = currentUserInfo.attributes['custom:StartDate']
        //const StopDate = currentUserInfo.attributes['custom:StopDate']
        //console.log(ReaderID, StartDate, StopDate)


      }
    });
  } else {
    switchToSignInView();
  }

}

/// REGISTER USER ///
// Starting point for user registration flow with input validation
function register() {

  switchToRegisterView();

  if (!$('#emailInput').val() || !$('#newUsernameInput').val() || !$('#newPasswordInput').val() || !$('#confirmPasswordInput').val()) {
    tellUser('Please fill all the fields!');
  } else {
    if ($('#newPasswordInput').val() == $('#confirmPasswordInput').val()) {
      registerUser($('#emailInput').val(), $('#newUsernameInput').val(), $('#newPasswordInput').val());
    } else {
      tellUser('Confirm password failed!');
    }

  }
}

// Starting point for user verification using AWS Cognito with input validation
function verifyCode() {
  if (!$('#verificationCodeInput').val()) {
    tellUser('Please enter verification field!');
  } else {
    cognitoUser.confirmRegistration($('#verificationCodeInput').val(), true, function(err, result) {
      if (err) {
        tellUser(err.message);
      } else {
        tellUser('Successfully verified code!');
        switchToSignInView();
      }

    });
  }
}

// User registration using AWS Cognito
function registerUser(email, username, password) {
  var attributeList = [];

  var dataEmail = {
    Name: 'email',
    Value: email
  };

  var attributeEmail = new AmazonCognitoIdentity.CognitoUserAttribute(dataEmail);

  attributeList.push(attributeEmail);

  userPool.signUp(username, password, attributeList, null, function(err, result) {
    if (err) {
      tellUser(err.message);
    } else {
      cognitoUser = result.user;
      tellUser('Registration Successful!');
      tellUser('Username is: ' + cognitoUser.getUsername());
      tellUser('Please enter the verification code sent to your Email.');
      switchToVerificationView();
    }
  });
}



/// GETTING CREDENTIALS ///
// This method will get temporary credentials for AWS using the IdentityPoolId and the Id Token recieved from AWS Cognito authentication provider.
function getCognitoIdentityCredentials() {

  AWS.config.region = region;

  var loginMap = {};
  loginMap['cognito-idp.' + region + '.amazonaws.com/' + userPoolId] = idToken;

  AWS.config.credentials = new AWS.CognitoIdentityCredentials({
    IdentityPoolId: identityPoolId,
    Logins: loginMap
  });

  AWS.config.credentials.clearCachedId();

  AWS.config.credentials.get(function(err) {
    if (err) {
      tellUser(err.message);
    } else {
      // Access Keys have now been granted
      // console.log('AWS Access Key: '+ AWS.config.credentials.accessKeyId);
      // console.log('AWS Secret Key: '+ AWS.config.credentials.secretAccessKey);
      // console.log('AWS Session Token: '+ AWS.config.credentials.sessionToken);
      switchToLoggedInView();
      SignedIn(StartTime, StopTime, Sensor);
      scanAndStoreAllTableNames();
    }
  });
}

/// ACCESSING DYNAMODB ///
// as soon as the user has logged in, scans all data table names

function scanAndStoreAllTableNames() {
  console.log("Scanning all table names...");
  var params = {
    TableName: tableName
  }

  docClient.scan(params, function(err, data) {
    if (err) {
      console.log(err);
      tellUser("There was an error accessing the database.")
    } else {
      tableNamesStored = data;
      $("#accessDataButton").show();
      tellUser("Connection established!");
    }
  });
}

// access data button; beginning of the flow to graph the data
function accessData() {
  deleteOldCharts()
  deleteOldButtons()
  //var tableName = "SkrootSensorTables";
  var sensorID = $("#sensorIdInput").val();
  //var StartTime = parseInt($("#startTimeInput").val());
  var TimeStart = $("#startTimeInput").val() + " 00:00:00 UTC"
  var TimeStop = $("#stopTimeInput").val() + " 00:00:00 UTC"
  var getEpochMillis = function(dateStr) {
    var r = /^\s*(\d{4})-(\d\d)-(\d\d)\s+(\d\d):(\d\d):(\d\d)\s+UTC\s*$/,
      m = ("" + dateStr).match(r);
    return (m) ? Date.UTC(m[1], m[2] - 1, m[3], m[4], m[5], m[6]) : undefined;
  };
  StartTimes = getEpochMillis(TimeStart) / 1000
  StopTimes = getEpochMillis(TimeStop) / 1000
  if ($("#startTimeInput").val() == "" && $("#stopTimeInput").val() == "") {
    var StopTimes = StopTime[0]
    var StartTimes = StartTime[0]
  } else if ($("#stopTimeInput").val() == "") {
    var StopTimes = StartTimes + 86400
  } else {
    var StopTimes = StopTimes
  }
  if (Number.isInteger(StartTimes) && Number.isInteger(StopTimes) && sensorID != "") {
    tellUser("Loading...");
    queryAndChartTableName2(StartTimes, StopTimes, sensorID)
  } else {
    tellUser("Please enter valid values");
  }
}


function deleteOldCharts2() {
  Charts2.forEach(deleteExtra2);
  Canvases2.forEach(deleteCanvas2);
}

function deleteOldButtons2() {
  buttonIdentity2.forEach(deleteExtraButtons2);
}

function deleteExtraButtons2(button) {
  document.getElementById(button).remove();
  buttonIdentity2 = []
}

function deleteExtra2(Chart) {
  Chart.destroy()
  Charts2 = []
}

function deleteCanvas2(Canvas) {
  Canvas.remove()
  Canvases2 = []
}

function deleteOldCharts() {
  Charts.forEach(deleteExtra);
  Canvases.forEach(deleteCanvas);
}

function deleteOldButtons() {
  buttonIdentity.forEach(deleteExtraButtons);
}

function deleteExtraButtons(button) {
  document.getElementById(button).remove();
  buttonIdentity = []

}

function deleteExtra(Chart) {
  Chart.destroy()
  Charts = []
}

function deleteCanvas(Canvas) {
  Canvas.remove()
  Canvases = []
}



function queryAndChartTableName2(StartTime, StopTime, sensorID) {
  var chartID = parseInt((Math.random() * 1000000), 10)
  var docClient = new AWS.DynamoDB.DocumentClient();
  var table;
  var tableName = "SkrootSensorTables";
  var params = {
    TableName: tableName,
    ProjectionExpression: "#tabn, #tim, #sid",
    FilterExpression: "#sid = :SensorID and #tim between :datStart and :datStop",
    ExpressionAttributeNames: {
      "#tim": "Timestamp",
      "#tabn": "TableName",
      "#sid": "SensorID"
    },
    ExpressionAttributeValues: {
      ":datStart": StartTime,
      ":datStop": StopTime,
      ":SensorID": sensorID
    }
  };
  docClient.scan(params, function(err, data) {
    if (err) {
      console.log(JSON.stringify(err, undefined, 2));
    } else {
      for (var i = 0; i <= data["Items"].length - 1; i++) {
        var dataTime = data["Items"][i]["Timestamp"];
        var dataTable = data["Items"][i]["TableName"];
        var dataSensor = data["Items"][i]["SensorID"];
        var ChartID = parseInt((Math.random() * 1000000), 10);
        queryAndChartData2(dataTable, dataSensor, ChartID, dataTime);
      }
    };
  });
};

function queryAndChartData2(tableName, sensorID, chartID, date) {
  var d = new Date(0);
  d.setUTCSeconds(date + 36000)
  dates = d.toString()
  var chartID = parseInt((Math.random() * 1000000), 10)
  date = dates.substring(0, 21) + ' UTC'
  var params = {
    TableName: tableName
  };

  docClient.scan(params, function(err, data) {
    if (err) {
      console.log(JSON.stringify(err, undefined, 2));
    } else {
      //console.log(JSON.stringify(data, undefined, 2));

      // refine the data to chart it
      times = [];
      for (var i = 0; i < data["Items"].length; i++) {
        var t = data["Items"][i]["Timestamp"];
        var t2 = t.toFixed(3)
        times.push(t2);
      }

      readings = [];
      for (var i = 0; i < data["Items"].length; i++) {
        var r = data["Items"][i]["Reading"];
        var r2 = r.toFixed(3)
        readings.push(r2);
      }
      var canvas = document.createElement('canvas');
      canvas.id = chartID;
      //var body2 = document.getElementById("head");
      var body2 = document.getElementById("loggedInView")
      body2.appendChild(canvas);
      Canvases.push(canvas)
      if (Canvases.length == 1) {
        TopPad = 0
      } else {
        TopPad = 50
      }
      var ctx1 = document.getElementById(chartID).getContext('2d');
      var chart = new Chart(ctx1, {
        type: 'line',
        data: {
          labels: times,
          datasets: [{
            data: readings,
            backgroundColor: 'rgba(0, 200, 255, 0.2)',
            borderColor: 'rgba(0, 200, 255, 1)',
            borderWidth: 1
          }]
        },
        options: {
          layout: {
            padding: {
              left: 0,
              right: 0,
              top: TopPad,
              bottom: 0
            },
          },
          scales: {
            yAxes: [{
              scaleLabel: {
                display: true,
                fontSize: 20,
                labelString: "Frequency (MHz)"
              },
            }],
            xAxes: [{
              scaleLabel: {
                display: true,
                fontSize: 20,
                labelString: "Time (hours)"
              },
            }]
          },
          legend: {
            display: false
          },
          title: {
            display: true,
            text: "SensorID: " + sensorID + "            Start Date: " + date,
            position: "top",
            fontSize: 16,
            padding: 20
          }
        }
      });
      Charts.push(chart)
      const chartElement = document.getElementById(chartID);
      const button = document.createElement('button');
      document.getElementById(button);
      button.padding = "100px 100px 100px 100px";
      button.innerHTML = "Download CSV File"
      button.addEventListener('click', download_csv.bind(this, times, readings));
      buttonId = parseInt((Math.random() * 1000000), 10)
      button.id = buttonId
      buttonIdentity.push(buttonId)
      chartElement.parentNode.insertBefore(button, chartElement.nextSibling);
    }
  });
}

function download_csv2(time, readings) {
  var csv = 'Time,Reading\n';
  var datas = [];
  for (let i = 0; i < readings.length; i++) {
    datas.push([time[i], readings[i]])
  }
  datas.forEach(function(row) {
    csv += row.join(',');
    csv += "\n";
  });

  var hiddenElement = document.createElement('a');
  hiddenElement.href = 'data:text/csv;charset=utf-8,' + encodeURI(csv);
  hiddenElement.target = '_blank';
  hiddenElement.download = 'SensorData.csv';
  hiddenElement.click();
}

function clearChart(chart) {
  if (chart != undefined) {
    chart.destroy();
  }
}

// Tell the user something
function tellUser(message) {
  $("#userOutput").empty();
  $("#userOutput").append(message + "</br>");
}
var docClient = new AWS.DynamoDB.DocumentClient();
var table;
var tableName = "SkrootSensorTables";

function queryAndChartTableName(StartDate, StopDate) {
  var params = {
    TableName: tableName,
    ProjectionExpression: "#tabn, #tim, #sid",
    FilterExpression: "#tim between :datStart and :datStop",
    ExpressionAttributeNames: {
      "#tim": "Timestamp",
      "#tabn": "TableName",
      "#sid": "SensorID"
    },
    ExpressionAttributeValues: {
      ":datStart": StartDate,
      ":datStop": StopDate,
    }
  };
  docClient.scan(params, function(err, data) {
    if (err) {
      console.log(JSON.stringify(err, undefined, 2));
    } else {
      for (var i = 0; i <= data["Items"].length - 1; i++) {
        var dataTime = data["Items"][i]["Timestamp"];
        var dataTable = data["Items"][i]["TableName"];
        var dataSensor = data["Items"][i]["SensorID"];
        var ChartID = parseInt((Math.random() * 1000000), 10);
        queryAndChartData(dataTable, dataSensor, ChartID, dataTime);
      }
    };
  });
};

function queryAndChartData(tableName, sensorID, chartID, date) {
  var d = new Date(0);
  d.setUTCSeconds(date + 36000)
  dates = d.toString()
  date = dates.substring(0, 21) + ' UTC'
  var params = {
    TableName: tableName
  };

  docClient.scan(params, function(err, data) {
    if (err) {
      console.log(JSON.stringify(err, undefined, 2));
    } else {
      //console.log(JSON.stringify(data, undefined, 2));

      // refine the data to chart it
      times = [];
      for (var i = 0; i < data["Items"].length; i++) {
        var t = data["Items"][i]["Timestamp"];
        var t2 = t.toFixed(3)
        times.push(t2);
      }

      readings = [];
      for (var i = 0; i < data["Items"].length; i++) {
        var r = data["Items"][i]["Reading"];
        var r2 = r.toFixed(3)
        readings.push(r2);
      }
      var canvas = document.createElement('canvas');
      canvas.id = chartID;
      //var body=document.getElementById("loggedInView")
      var body = document.getElementsByTagName("Body")[0];
      body.appendChild(canvas);
      Canvases2.push(canvas)
      var ctx1 = document.getElementById(chartID).getContext('2d');
      var myChar1 = new Chart(ctx1, {
        type: 'line',
        data: {
          labels: times,
          datasets: [{
            data: readings,
            backgroundColor: 'rgba(0, 200, 255, 0.2)',
            borderColor: 'rgba(0, 200, 255, 1)',
            borderWidth: 1
          }]
        },
        options: {
          layout: {
            padding: {
              left: 0,
              right: 0,
              top: 50,
              bottom: 0
            },
          },
          scales: {
            yAxes: [{
              scaleLabel: {
                display: true,
                fontSize: 20,
                labelString: "Frequency (MHz)"
              },
            }],
            xAxes: [{
              scaleLabel: {
                display: true,
                fontSize: 20,
                labelString: "Time (hours)"
              },
            }]
          },
          legend: {
            display: false
          },
          title: {
            display: true,
            text: "SensorID: " + sensorID + "            Start Date: " + date,
            position: "top",
            fontSize: 16,
            padding: 20
          }
        }
      });
      Charts2.push(myChar1)
      const chartElement = document.getElementById(chartID);
      const button = document.createElement('button');
      document.getElementById(button);
      button.padding = "100px 100px 100px 100px";
      button.innerHTML = "Download CSV File"
      button.addEventListener('click', download_csv.bind(this, times, readings));
      buttonId = parseInt((Math.random() * 1000000), 10)
      button.id = buttonId
      buttonIdentity2.push(buttonId)
      chartElement.parentNode.insertBefore(button, chartElement.nextSibling);
    }
  });
}

function download_csv(time, readings) {
  var csv = 'Time,Reading\n';
  var datas = [];
  for (let i = 0; i < readings.length; i++) {
    datas.push([time[i], readings[i]])
  }
  datas.forEach(function(row) {
    csv += row.join(',');
    csv += "\n";
  });

  var hiddenElement = document.createElement('a');
  hiddenElement.href = 'data:text/csv;charset=utf-8,' + encodeURI(csv);
  hiddenElement.target = '_blank';
  hiddenElement.download = 'SensorData.csv';
  hiddenElement.click();
}

var j = 1
var buttons = 0
// Enter in each of the sensorIDs and start/stop times below. Ensure correct order when entering this.
let TimeStart = ['2020-07-08 00:00:00 UTC'] //, '2020-07-04 00:00:00 UTC', '2020-07-04 00:00:00 UTC']
// Input the day the sensors are given to the customer here
let TimeStop = ['2020-09-10 00:00:00 UTC'] //, '2020-07-04 00:00:00 UTC', '2020-07-04 00:00:00 UTC']
// Input the day the sensors are going to be returned here (if not sure input a few years into the future -> do not forget to change this!!!)
let Sensor = ["33B178", "5EAD48", "BE2312"]
// Input the SensorID given to the customer here

var getEpochMillis = function(dateStr) {
  var r = /^\s*(\d{4})-(\d\d)-(\d\d)\s+(\d\d):(\d\d):(\d\d)\s+UTC\s*$/,
    m = ("" + dateStr).match(r);
  return (m) ? Date.UTC(m[1], m[2] - 1, m[3], m[4], m[5], m[6]) : undefined;
};
StartTime = []
StopTime = []
Charts = []
buttonIdentity = []
Canvases = []
Charts2 = []
buttonIdentity2 = []
Canvases2 = []
LinkText = "Blah"
for (var L = 0; L <= TimeStart.length; L++) {
  StartTime.push(getEpochMillis(TimeStart[L]) / 1000)
  StopTime.push(getEpochMillis(TimeStop[L]) / 1000)
}

function SignedIn(StartTime, StopTime, Sensor) {
  timeout = 1
  myVar = setTimeout(RunningTests, timeout, StartTime, StopTime, 0)
  //for (var f = 0; f <= StartTime.length; f++) {
  //  timeout = 500 * f
  //  myVar = setTimeout(RunningTests, timeout, StartTime, StopTime, f)
  //}
}

function RunningTests(StartTime, StopTime, f) {
  try {
    queryAndChartTableName(StartTime[f], StopTime[f])
  } catch (err) {
    document.getElementById("demo").innerHTML = err.message;
    console.log("What?!?!")
  }
}

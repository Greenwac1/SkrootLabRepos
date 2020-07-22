/*
Based partially off code designed and written by Suminda De Silva
  https://auxenta.com/blog_User_Authentication_and_Authorization_with_AWS_Cognito.php
Rewritten by Adam Rice and Cameron Greenwalt - Skroot Labs Inc.
*/


/// ************ VARIABLES ************ ///

// AWS IDs
var userPoolId = 'us-east-2_GfASc6bnY';
var clientId = '1t46ujgd3tl59vtutuvkmnah53';
var region = 'us-east-2';
var identityPoolId = 'us-east-2:d1ff2dd9-319a-4a15-af35-c60b1e0f088a';

// other cognito variables
var cognitoUser;
var idToken;
var userPool;

// cognito user pool data object
var poolData = {
  UserPoolId: userPoolId,
  ClientId: clientId
};

// dynamoDB configuation vairables
var docClient;
var tableName = "SkrootSensorTables";
var maximumChartValues = 200;

// all results are accessed between earliestTime and latestTime
var earliestTime = getEpochMillis('2020-07-08 00:00:00 UTC');
var latestTime = getEpochMillis('2020-09-10 00:00:00 UTC');

// 2D array holding the elements on the page under search results
var searchResultsElements = [
  // [chart, canvas, buttonId],
  // ...
];
// 2D array holding the elements on the page under all results
var allResultsElements = [
  // [chart, canvas, buttonId],
  // ...
];

switchToRegisterView();
getCurrentLoggedInSession();


/// ************ FUNCTIONS ************ ///

/// VIEW CONTROLLERS ///
function hideAll() {
  tellUser("");
  $("#registerView").hide();
  $("#verificationView").hide();
  $("#signInView").hide();
  $("#loggedInView").hide();
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
    deleteOldCharts(allResultsElements);

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
      $("#accessDataButton").show();

      queryAndChart(earliestTime, latestTime, null, allResultsElements, 'body');
    }
  });
}

/// ACCESSING DYNAMODB ///
// access data button; beginning of the flow to graph the data
function accessData() {
  // delete old search results
  deleteOldCharts(searchResultsElements);

  // access the user's inputs
  var sensorID = $("#sensorIdInput").val();
  var startTime = $("#startTimeInput").val() + " 00:00:00 UTC";
  var stopTime = $("#stopTimeInput").val() + " 00:00:00 UTC";

  // convert given times to epoch times
  startTime = getEpochMillis(startTime);
  stopTime = getEpochMillis(stopTime);

  // handling the absence of some inputs
  if ($("#startTimeInput").val() == "" && $("#stopTimeInput").val() == "") {
    // with only the sensorId, use default start and stop times as the bounds
    startTime = earliestTime;
    stopTime = latestTime;
  } else if ($("#stopTimeInput").val() == "") {
    // without a stop time, default of one day later
    stopTime = startTime + 86400;
  }


  // make sure there is a sensorId, and that the start and stop times are numbers
  if (Number.isInteger(startTime) && Number.isInteger(stopTime) && sensorID != "") {
    tellUser("Loading...");
    queryAndChart(startTime, stopTime, sensorID, searchResultsElements, 'loggedInView');
  } else {
    tellUser("Please enter valid values");
  }
}

// beginning of the flow to chart data — leave sensorID as null for all results between start and stop time
// stores the created elements in storageArray in format [chart, canvas, buttonId]
// inserts the element into the element with id as insertionPointId
function queryAndChart(startTime, stopTime, sensorID, storageArray, insertionPointId) {

  var filterExp;
  var attributeVals = {
    ":datStart": startTime,
    ":datStop": stopTime
  }

  if (sensorID != null) {
    filterExp = "#sid = :SensorID and #tim between :datStart and :datStop";
    attributeVals[":SensorID"] = sensorID;
  } else {
    filterExp = "#tim between :datStart and :datStop";
  }

  var params = {
    TableName: tableName,
    ProjectionExpression: "#tabn, #tim, #sid",
    FilterExpression: filterExp,
    ExpressionAttributeNames: {
      "#tim": "Timestamp",
      "#tabn": "TableName",
      "#sid": "SensorID"
    },
    ExpressionAttributeValues: attributeVals
  };
  docClient.scan(params, function(err, data) {
    if (err) {
      console.log(JSON.stringify(err, undefined, 2));
    } else {
      for (var i = 0; i <= data["Items"].length - 1; i++) {
        var dataTime = data["Items"][i]["Timestamp"];
        var dataTable = data["Items"][i]["TableName"];
        var dataSensor = data["Items"][i]["SensorID"];
        var chartID = parseInt((Math.random() * 1000000), 10);
        //******
        queryAndChartData(dataTable, dataSensor, chartID, dataTime, storageArray, insertionPointId);
        //******//
      }
    };
  });
};
function queryAndChartData(tableName, sensorID, chartID, date, storageArray, insertionPointId) {
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

      // refine the data to chart it:

      // if the data has lots and lots of points, set a maximum
      var simplifyFactor = data["Items"].length / maximumChartValues;
      if (simplifyFactor < 1) {
          simplifyFactor = 1;
      }

      // obtain the times and readings
      times = [];
      readings = [];
      for (var floatingPointIndex = 0; floatingPointIndex < data["Items"].length; floatingPointIndex += simplifyFactor) {
        // usable index
        var i = Math.floor(floatingPointIndex);
        // store times
        var t = data["Items"][i]["Timestamp"];
        var t2 = t.toFixed(3);
        times.push(t2);

        // store readings
        var r = data["Items"][i]["Reading"];
        var r2 = r.toFixed(5);
        readings.push(r2);
      }

      var canvas = document.createElement('canvas');
      canvas.id = chartID;

      // chart the data
      var view = document.getElementById(insertionPointId);
      view.appendChild(canvas);

      var ctx1 = canvas.getContext('2d');
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

      const chartElement = document.getElementById(chartID);
      const button = document.createElement('button');
      document.getElementById(button);
      button.padding = "100px 100px 100px 100px";
      button.innerHTML = "Download CSV File"
      button.addEventListener('click', download_csv.bind(this, times, readings));
      buttonId = parseInt((Math.random() * 1000000), 10)
      button.id = buttonId
      chartElement.parentNode.insertBefore(button, chartElement.nextSibling);

      storageArray.push([chart, canvas, buttonId]);
    }
  });
}

// Tell the user something
function tellUser(message) {
  $("#userOutput").empty();
  $("#userOutput").append(message + "</br>");
}

// downloads a csv file of the times and readings given
function download_csv(times, readings) {
  var csv = 'Time,Reading\n';
  var datas = [];
  for (let i = 0; i < readings.length; i++) {
    datas.push([times[i], readings[i]])
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

// resetting the charts
function deleteOldCharts(chartArray) {

  chartArray.forEach(function(array) {
    // delete the chart
    array[0].destroy();
    // delete the canvas
    array[1].remove();
    // delete the download button
    var button = document.getElementById(array[2])
    button ? button.remove() : null;
  });
  chartArray = []
}

function getEpochMillis(dateStr) {
  var r = /^\s*(\d{4})-(\d\d)-(\d\d)\s+(\d\d):(\d\d):(\d\d)\s+UTC\s*$/,
    m = ("" + dateStr).match(r);
  return (m) ? Date.UTC(m[1], m[2] - 1, m[3], m[4], m[5], m[6]) / 1000 : undefined;
};

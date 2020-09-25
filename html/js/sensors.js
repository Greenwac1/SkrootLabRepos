/*
Based partially off code designed and written by Suminda De Silva
  https://auxenta.com/blog_User_Authentication_and_Authorization_with_AWS_Cognito.php
Rewritten by Adam Rice and Cameron Greenwalt - Skroot Labs Inc.
*/

/// ************ Press button when enter is pressed *************** ///
var input = document.getElementById("passwordInput");
input.addEventListener("keyup", function(event) {
  if (event.keyCode === 13) {
    event.preventDefault();
    document.getElementById("logInButton").click();
  }
});

function passwordToggle() {
  var x = document.getElementById("passwordInput");
  if (x.type === "password") {
    x.type = "text";
  } else {
    x.type = "password";
  }
}

function newPasswordToggle() {
  var x = document.getElementById("passwordInput");
  if (x.type === "password") {
    x.type = "text";
  } else {
    x.type = "password";
  }
}

var input = document.getElementById("startTimeInput");
input.addEventListener("keyup", function(event) {
  if (event.keyCode === 13) {
    event.preventDefault();
    document.getElementById("accessDataButton").click();
  }
});

var input = document.getElementById("stopTimeInput");
input.addEventListener("keyup", function(event) {
  if (event.keyCode === 13) {
    event.preventDefault();
    document.getElementById("accessDataButton").click();
  }
});

var input = document.getElementById("sensorIdInput");
input.addEventListener("keyup", function(event) {
  if (event.keyCode === 13) {
    event.preventDefault();
    document.getElementById("accessDataButton").click();
  }
});

var input = document.getElementById("usernameRecoveryInput");
input.addEventListener("keyup", function(event) {
  if (event.keyCode === 13) {
    event.preventDefault();
    document.getElementById("recoverPasswordButton").click();
  }
});

var input = document.getElementById("newPasswordInput");
input.addEventListener("keyup", function(event) {
  if (event.keyCode === 13) {
    event.preventDefault();
    document.getElementById("submitButton").click();
  }
});
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
var maximumChartValues = 300;

// all results are accessed between earliestTime and latestTime
var earliestTime = getEpochMillis('2020-07-08 00:00:00 UTC');
var latestTime = getEpochMillis('2022-09-10 00:00:00 UTC');
var nextCanvasId = 0;

var chartsBeingLoaded;
var loadTrackingNumber;

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

switchToSignInView();
getCurrentLoggedInSession();


/// ************ FUNCTIONS ************ ///

/// VIEW CONTROLLERS ///
function hideAll() {
  tellUser("");
  $("#registerView").hide();
  $("#verificationView").hide();
  $("#signInView").hide();
  $("#loggedInView").hide();
  $("#forgotPasswordView").hide();
  $("#firstSignInView").hide();
}

function switchToSignInView() {
  hideAll();
  $("#signInView").show();
}

function switchToFirstSignInView() {
  hideAll();
  $("#firstSignInView").show();
}

function switchToRecoverPasswordView() {
  hideAll();
  $("#forgotPasswordView").show();
}

function switchToLoggedInView() {
  hideAll();
  $("#loggedInView").show();
  // var element = document.getElementById("head");
  // element.innerHTML = "All Results"
  docClient = new AWS.DynamoDB.DocumentClient();
}

function recoverPassword() {
  hideAll();
  $("#verificationView").show();
  params = {
    "ClientId": clientId,
    "Username": $('#usernameRecoveryInput').val(),
  }
  userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
  cognitoUser = new AmazonCognitoIdentity.CognitoUser({
    Username: $('#usernameRecoveryInput').val(),
    Pool: userPool
  });
  cognitoUser.forgotPassword({
    onSuccess: function(result) {
      console.log('call result: ' + result);
      console.log(result)
    },
    onFailure: function(err) {
      alert(err.message);
    },
  })
}

function confirmPassword(verificationCode, newPassword) {
  userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
  cognitoUser = new AmazonCognitoIdentity.CognitoUser({
    Username: $('#usernameRecoveryInput').val(),
    Pool: userPool
  });
  return new Promise((resolve, reject) => {
    verificationCode = $('#verificationCodeInput').val(),
      newPassword = $('#newPasswordInput').val(),
      cognitoUser.confirmPassword(verificationCode, newPassword, {
        onFailure(err) {
          alert(err.message)
          console.log(err)
          reject(err);
        },
        onSuccess() {
          switchToSignInView()
          resolve();
        },
      });
  });
}

/// LOG IN AND OUT ///
function logOut() {
  if (cognitoUser != null) {
    switchToSignInView();
    cognitoUser.signOut();
    tellUser('Logged out!');
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
        alert(err.message)
        tellUser(err.message);
      },

      newPasswordRequired: userattr => {
        var isFirstLogin = true
        var userAttr = userAttr
        const newPassword = $("#passwordInput").val()
        cognitoUser.completeNewPasswordChallenge(newPassword, userAttr, {
          onSuccess: result => {
            console.log('success!')
            switchToLoggedInView()
          },
          onFailure: function(err) {
            alert(err.message)
            console.log(err.message)
          }
        });
      }
    });
  };
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
      //$("#accessDataButton").show();

      queryAndChart(earliestTime, latestTime, null, allResultsElements, 'allResultsSection');
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
    queryAndChart(startTime, stopTime, sensorID, searchResultsElements, 'searchResultsSection');
  } else {
    tellUser("Please enter valid values");
  }
}

// beginning of the flow to chart data — leave sensorID as null for all results between start and stop time
// stores the created elements in storageArray in format [chart, canvas, buttonId]
// inserts the element into the element with id as insertionPointId
function queryAndChart(startTime, stopTime, sensorID, storageArray, insertionPointId) {
  // setting the expressions based on which arguments are given
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

  // setting parameters accordingly
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
      // tracks when the charts have been loaded, shows the search button again once all charts are finished
      chartsBeingLoaded = data["Items"].length;
      loadTrackingNumber = 0;
      // $("#accessDataButton").hide();

      // goes through all the data tables, charts each table
      for (var i = 0; i <= data["Items"].length - 1; i++) {
        var dataTime = data["Items"][i]["Timestamp"];
        var dataTable = data["Items"][i]["TableName"];
        var dataSensor = data["Items"][i]["SensorID"];

        queryAndChartData(dataTable, dataSensor, dataTime, storageArray, insertionPointId);
      }
    };
  });
};

function queryAndChartData(tableName, sensorID, date, storageArray, insertionPointId) {
  var d = new Date(0);
  d.setUTCSeconds(date + 36000);
  dates = d.toString();
  date = dates.substring(0, 21) + ' UTC';
  var params = {
    TableName: tableName
  };
  console.log(params);

  docClient.scan(params, function(err, data) {
    if (err) {
      console.log("Unable to find the data!");
      chartsBeingLoaded--;
    } else {
      // refining and charting the data //

      // if the data has lots and lots of points, set a maximum number of
      var simplifyFactor = data["Items"].length / maximumChartValues;
      if (simplifyFactor < 1) {
        simplifyFactor = 1;
      }

      // obtain the times and readings
      times = [];
      readings = [];
      for (var floatingPointIndex = 0; floatingPointIndex < data["Items"].length; floatingPointIndex += simplifyFactor) {
        /*
        if we have a max of 10 points, with 12 points being charted the sequence will go:
          - floatingPointIndex: 0, 1.2, 2.4, 3.6, 4.8, 6.0, ...
          - useable index (i):  0, 1,   2,   3,   4,   6, ...
        */
        // useable index
        var i = Math.floor(floatingPointIndex);
        // store times
        var t = data["Items"][i]["Timestamp"];
        var t2 = t.toFixed(3);
        times.push(t2);

        // store readings
        var r = data["Items"][i]["Reading"];
        var r2 = r.toFixed(3);
        readings.push(r2);
      }

      nextCanvasId++;
      var canvas = document.createElement('canvas');
      canvas.id = nextCanvasId;
      canvas.className = "chart";

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
            borderWidth: 1,
            lineTension: .2
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

      const button = document.createElement('button');
      button.padding = "100px 100px 100px 100px";
      button.innerHTML = "Download CSV File"
      button.addEventListener('click', download_csv.bind(this, times, readings));
      buttonId = nextCanvasId + "b";
      button.id = buttonId;

      canvas.parentNode.insertBefore(button, canvas.nextSibling);

      storageArray.push([chart, canvas, buttonId]);

      finishedLoadingChart();
    }
  });
}

// called once a chart has been finished loading. tracks the total number of charts loaded compared to the number of charts that need to be loaded.
// if this is the last chart in the scan that was loaded, the search button is shown.
function finishedLoadingChart() {
  loadTrackingNumber++;
  console.log(loadTrackingNumber)
  console.log(chartsBeingLoaded)
  if (loadTrackingNumber >= chartsBeingLoaded) {
    $("#accessDataButton").show();
  }
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

//
function getEpochMillis(dateStr) {
  var r = /^\s*(\d{4})-(\d\d)-(\d\d)\s+(\d\d):(\d\d):(\d\d)\s+UTC\s*$/,
    m = ("" + dateStr).match(r);
  return (m) ? Date.UTC(m[1], m[2] - 1, m[3], m[4], m[5], m[6]) / 1000 : undefined;
};

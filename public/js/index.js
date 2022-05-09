$.ajax({
    url: '/getTherapists',
    type: "GET",
    success: function (data) {
        var firstCard = data[1];
        var mainCard = data[2];
        var thirdCard = data[0];
        var x = '<div class="therapyCard">';
        x += `<h2>$${firstCard.sessionCost}<span> / session</span></h2>`
        x += '<h4>Therapist Details</h4>'
        x += `<p>${firstCard.firstName} ${firstCard.lastName}</p>`
        x += `<p>${firstCard.yearsExperience} years of experience</p>`
        x += '<div><a href="/therapists">View Therapist</a></div>'
        x += '</div>'
        var y = '<div class="therapyCard mainCard">';
        y += `<h2>$${mainCard.sessionCost}<span> / session</span></h2>`
        y += '<h4>Therapist Details</h4>'
        y += `<p>${mainCard.firstName} ${mainCard.lastName}</p>`
        y += `<p>${mainCard.yearsExperience} years of experience</p>`
        y += '<div><a href="/therapists">View Therapist</a></div>'
        y += '</div>'
        var z = '<div class="therapyCard">';
        z += `<h2>$${thirdCard.sessionCost}<span> / session</span></h2>`
        z += '<h4>Therapist Details</h4>'
        z += `<p>${thirdCard.firstName} ${thirdCard.lastName}</p>`
        z += `<p>${thirdCard.yearsExperience} years of experience</p>`
        z += '<div><a href="/therapists">View Therapist</a></div>'
        z += '</div>'
        document.getElementById("therapistCards").innerHTML += x;
        document.getElementById("therapistCards").innerHTML += y;
        document.getElementById("therapistCards").innerHTML += z;
    }
})
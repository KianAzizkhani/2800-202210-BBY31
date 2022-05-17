const cartExistModal = document.getElementById('cartExistModal');
const therapistExistModal = document.getElementById('therapySessionExistModal');
const notAuthorizedModal = document.getElementById('notAuthorizedModal');

$(document).ready(async function () {
    await $.ajax({
        url: '/getTherapists',
        type: "GET",
        success: function (data) {
            data.forEach(function (Therapist) {
                var x = `<div class="therapistCard">`;
                x += `<img src="${Therapist.profileImg}" alt="Therapist 1">`
                x += '<div class="cardContent">'
                x += `<h3>${Therapist.firstName} ${Therapist.lastName}</h3>`
                x += `<p>${Therapist.yearsExperience} years of experience in the profession, and offers $${Therapist.sessionCost} per session</p>`
                x += `<div><button class="therapistBtn" id="${Therapist._id}">Purchase Session</button></div>`
                x += '</div>'
                x += '</div>'
                document.getElementById("therapistList").innerHTML += x;
            })
        }
    })

    // Disable buttons for admin, therapists, and logged out users
    const therapistBtns = document.querySelectorAll(".therapistBtn");
    therapistBtns.forEach(function (btn) {
        $(btn).click(() => {
            $.ajax({
                url: "/addToCart",
                type: "POST",
                data: {
                    therapist: btn.id
                },
                success: function (data) {
                    $.get('/isLoggedIn', function (user) {
                        if (user.userType != 'patient') {
                            notAuthorizedModal.style.display = 'block';
                            // therapistBtns[i].disabled = true;
                            btn.title = "Only patients can purchase therapy sessions."
                            btn.style.cursor = "context-menu";
                        } else {
                            if (data == 'cartExists') {
                                cartExistModal.style.display = 'block';
                                document.body.style.overflow = 'hidden';
                            } else if (data == "orderExists") {
                                //display error message pop up for when user already has a therapist.
                                setTimeout(() => {
                                    $.get('/activeSession', function (data) {
                                        console.log(data)
                                        $("#therapistName").text(`${data.therapistName}.`);
                                        $("#expireDate").text(`${new Date(data.purchased).toLocaleString('en-CA', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric'
                                        })}`)
                                        $("#expireTime").text(`${new Date(data.purchased).toLocaleString('en-CA', { hour: 'numeric', minute: 'numeric', hour12: true })}`)
                                    })
                                    therapistExistModal.style.display = 'block';
                                    document.body.style.overflow = 'hidden';
                                }, 50);
                            } else {
                                window.location = "/checkout"
                            }
                        }
                    });
                }
            })
        })
    })
})

// If cancel button is clicked, hide modal for Cart Exist 
document.getElementById("closeCart").onclick = function () {
    cartExistModal.style.display = "none";
    document.body.style.overflow = 'auto';
}

document.getElementById("closeSession").onclick = function () {
    therapistExistModal.style.display = "none";
    document.body.style.overflow = 'auto';
}

document.getElementById("closeAuthorized").onclick = function () {
    notAuthorizedModal.style.display = "none";
    document.body.style.overflow = 'auto';
}

// If user clicks outside of the modal for Cart Exist Modal then hide modal
window.onclick = function (event) {
    if (event.target == cartExistModal) {
        cartExistModal.style.display = "none";
        document.body.style.overflow = 'auto';
    } else if (event.target == therapistExistModal) {
        therapistExistModal.style.display = "none";
        document.body.style.overflow = 'auto';
    }
}
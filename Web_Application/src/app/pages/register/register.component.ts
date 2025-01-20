import { Component } from '@angular/core';
import { Router } from '@angular/router';

import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
})

export class RegisterComponent {
  user = {
    email: '',
    password: '',
  };

  constructor(private router: Router, private http: HttpClient) {}

  onSubmit() {
    const url = 'http://127.0.0.1:5000/register';
    this.http.post(url, this.user).subscribe(
      (response) => {
        console.log('Registration successful:', response);
        this.router.navigate(['/map'], { queryParams: { email: this.user.email } });
      },
      (error) => {
        alert('Registration failed: ' + 'Account already exists');
      }
    );
  }
}

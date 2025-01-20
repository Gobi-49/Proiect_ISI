import { Component } from '@angular/core';
import { Router } from '@angular/router';

import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})

export class LoginComponent {
  user = {
    email: '',
    password: '',
  };

  constructor(private router: Router, private http: HttpClient) {}

  onSubmit() {
    const url = 'http://127.0.0.1:5000/login';
    this.http.post(url, this.user).subscribe(
      (response) => {
        console.log('Login successful:', response);
        this.router.navigate(['/map'], { queryParams: { email: this.user.email } });
      },
      (error) => {
        console.error('Login failed:', error);
        alert('Login failed: ' + 'Incorrect email or password');
      }
    );
  }
}

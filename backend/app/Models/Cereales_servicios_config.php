<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Cereales_servicios_config extends Model
{
    
    protected $table = "cereales_servicios_config";
    public $timestamps = false;

    protected $fillable = [
        'idServicio',
        'idRecetaParametro',
        'activo'
    ];

}
